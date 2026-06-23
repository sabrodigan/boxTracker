import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Box, Item, insertItemSchema, insertBoxSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link, useParams, Redirect } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { Package2Icon, ArrowLeftIcon, PlusIcon, Trash2Icon, MapPinIcon, Loader2Icon, PrinterIcon, PencilIcon } from "lucide-react";
import { BoxQrCode } from "@/components/box-qr-code";
import { EditItemDialog } from "@/components/edit-item-dialog";
import { printBoxLabel } from "@/lib/print-label";
import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function BoxPage() {
  const params = useParams<{ id: string }>();
  const boxId = params?.id;
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditBoxOpen, setIsEditBoxOpen] = useState(false);
  const { toast } = useToast();

  // Return to home if boxId is invalid
  if (!boxId) {
    return <Redirect to="/" />;
  }

  const { data: box, isLoading: isLoadingBox, error: boxError } = useQuery<Box>({
    queryKey: [`/api/boxes/${boxId}`],
  });

  const { data: items = [], isLoading: isLoadingItems } = useQuery<Item[]>({
    queryKey: [`/api/boxes/${boxId}/items`],
    enabled: !!box, // Only fetch items if box exists
  });

  const { data: allBoxes = [] } = useQuery<Box[]>({
    queryKey: ["/api/boxes"],
  });

  const form = useForm({
    resolver: zodResolver(insertItemSchema),
    defaultValues: {
      name: "",
      description: "",
      boxId,
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; boxId: string }) => {
      const res = await apiRequest("POST", `/api/boxes/${boxId}/items`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boxes/${boxId}/items`] });
      setIsAddItemOpen(false);
      form.reset({ boxId });
    },
    onError: (error) => {
      toast({
        title: "Failed to add item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boxes/${boxId}/items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/boxes"] });
    },
  });

  const deleteBoxMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/boxes/${boxId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boxes"] });
      window.location.href = "/";
    },
  });

  const editBoxForm = useForm({
    resolver: zodResolver(insertBoxSchema),
    defaultValues: { name: "", location: "" },
  });

  useEffect(() => {
    if (box && isEditBoxOpen) {
      editBoxForm.reset({ name: box.name, location: box.location });
    }
  }, [box, isEditBoxOpen, editBoxForm]);

  const editBoxMutation = useMutation({
    mutationFn: async (data: { name: string; location: string }) => {
      const res = await apiRequest("PUT", `/api/boxes/${boxId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boxes/${boxId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/boxes"] });
      setIsEditBoxOpen(false);
      toast({ title: "Box updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update box",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveItemMutation = useMutation({
    mutationFn: async ({ itemId, newBoxId }: { itemId: string; newBoxId: string }) => {
      const res = await apiRequest("PATCH", `/api/items/${itemId}/move`, { boxId: newBoxId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boxes/${boxId}/items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/boxes"] });
      // Also invalidate the target box's items so it shows up if previously cached
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== `/api/boxes/${boxId}/items` && query.queryKey[0]?.toString().includes('/items') });
    },
  });

  const handleMoveItem = async (itemId: string, newBoxId: string) => {
    await moveItemMutation.mutate({ itemId, newBoxId });
  };

  // Loading state
  if (isLoadingBox || isLoadingItems) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (boxError || !box) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{box.name}</h1>
                <div className="flex items-center text-muted-foreground mt-1">
                  <MapPinIcon className="h-4 w-4 mr-2" />
                  <span>{box.location}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                variant="default"
                onClick={async () => {
                  try {
                    await printBoxLabel(box);
                  } catch (err: any) {
                    toast({
                      title: "Failed to print label",
                      description: String(err?.message || err),
                      variant: "destructive",
                    });
                  }
                }}
              >
                <PrinterIcon className="h-4 w-4 mr-2" />
                Print label
              </Button>
              <BoxQrCode boxId={box.id} token={box.qrToken} boxName={box.name} boxLocation={box.location} />
              <Dialog open={isEditBoxOpen} onOpenChange={setIsEditBoxOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <PencilIcon className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Box</DialogTitle>
                  </DialogHeader>
                  <Form {...editBoxForm}>
                    <form onSubmit={editBoxForm.handleSubmit((data) => editBoxMutation.mutate(data))}>
                      <div className="space-y-4">
                        <FormField
                          control={editBoxForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Box Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editBoxForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location / Description</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="e.g. Garage, Top Shelf, Left Wall" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={editBoxMutation.isPending}>
                          {editBoxMutation.isPending ? "Saving..." : "Save changes"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2Icon className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the box and all items inside it.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteBoxMutation.mutate()}
                      disabled={deleteBoxMutation.isPending}
                    >
                      {deleteBoxMutation.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          {/* Add Item Button */}
          <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
            <DialogTrigger asChild>
              <Button className="w-fit">
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => addItemMutation.mutate(data))}>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={addItemMutation.isPending}>
                      {addItemMutation.isPending ? "Adding..." : "Add Item"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Items List */}
          {items.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Package2Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No items in this box yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {items.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          onValueChange={(value) => handleMoveItem(item.id, value)}
                          disabled={moveItemMutation.isPending}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Move to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allBoxes
                              .filter((b) => b.id !== boxId) // Filter out current box
                              .map((box) => (
                                <SelectItem key={box.id} value={box.id.toString()}>
                                  {box.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <EditItemDialog item={item} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2Icon className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Item</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this item?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteItemMutation.mutate(item.id)}
                                disabled={deleteItemMutation.isPending}
                              >
                                {deleteItemMutation.isPending ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}