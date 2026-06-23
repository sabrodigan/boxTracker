import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Box, insertBoxSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import { SearchIcon, PlusIcon, PackageIcon, LogOutIcon, MapPinIcon, PrinterIcon, Package2Icon } from "lucide-react";
import { QrScannerDialog } from "@/components/qr-scanner-dialog";
import { SmallQrCode } from "@/components/small-qr-code";
import { printBoxLabel } from "@/lib/print-label";
import { useState, useMemo } from "react";
import { EditItemDialog } from "@/components/edit-item-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Item = {
  id: string;
  name: string;
  description?: string;
  boxId: string;
};

type SearchResult = {
  box: Box;
  items: Item[];
};

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddBoxOpen, setIsAddBoxOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sortOrder, setSortOrder] = useState<"numerical" | "alphabetical">("numerical");
  const [, setLocation] = useLocation();

  const { data: boxes = [] } = useQuery<(Box & { itemCount: number })[]>({
    queryKey: ["/api/boxes"],
  });

  const sortedBoxes = useMemo(() => {
    return [...boxes].sort((a, b) => {
      if (sortOrder === "numerical") {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      }
      return a.name.localeCompare(b.name);
    });
  }, [boxes, sortOrder]);

  const { data: searchResults = [] } = useQuery<SearchResult[]>({
    queryKey: ["/api/search", searchQuery],
    enabled: searchQuery.trim().length > 0,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(searchQuery)}&_t=${Date.now()}`);
      return res.json();
    }
  });

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    const ql = q.toLowerCase();
    // Run the item-content search
    setIsSearching(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const form = useForm({
    resolver: zodResolver(insertBoxSchema),
    defaultValues: {
      name: "",
      location: "",
    },
  });

  const addBoxMutation = useMutation({
    mutationFn: async (data: { name: string; location: string }) => {
      const res = await apiRequest("POST", "/api/boxes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boxes"] });
      setIsAddBoxOpen(false);
      form.reset();
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-6 w-6" />
            <h1 className="text-2xl font-bold">BoxTracker</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">Welcome, {user?.username}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOutIcon className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          {/* Search and Add Box */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search boxes or items..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearching(false); // Reset search when input changes
                  }}
                  onKeyPress={handleKeyPress}
                />
                
                {/* Live Autocomplete Dropdown */}
                {searchQuery.trim().length > 0 && !isSearching && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-popover border text-popover-foreground rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
                    <div className="p-2 space-y-1">
                      {searchResults.map((result) => (
                        <div key={result.box.id} className="mb-2">
                          {result.items.map(item => (
                            <button
                              key={item.id}
                              className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
                              onClick={() => setLocation(`/box/${result.box.id}`)}
                            >
                              <div className="min-w-0">
                                <span className="font-medium truncate block">{item.name}</span>
                                <span className="text-xs text-muted-foreground truncate block">in {result.box.name}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
              </div>
              <Button 
                variant="secondary" 
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
              >
                <SearchIcon className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
            <QrScannerDialog />
            <QrScannerDialog
              mode="print"
              triggerLabel="Scan & print"
              triggerVariant="outline"
              triggerIcon="print"
            />
            <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numerical">Numerical</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isAddBoxOpen} onOpenChange={setIsAddBoxOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Box
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Box</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => addBoxMutation.mutate(data))}>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Box Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. Holiday Decorations" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. Left Wall, Top Shelf" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={addBoxMutation.isPending}>
                        {addBoxMutation.isPending ? "Adding..." : "Add Box"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Box name/location matches (always shown while typing or after Search) */}
          {searchQuery && (
            <Card>
              <CardHeader>
                <CardTitle>Matching boxes</CardTitle>
              </CardHeader>
              <CardContent>
                {sortedBoxes.filter(b =>
                  b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  b.location.toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {isSearching
                      ? `No boxes match "${searchQuery}" by name or location.`
                      : <>No box names match "{searchQuery}". Press <strong>Search</strong> to look inside box contents.</>}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sortedBoxes
                      .filter(b =>
                        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        b.location.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(box => (
                        <div key={box.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{box.name}</h3>
                            <div className="flex items-center text-muted-foreground">
                              <MapPinIcon className="h-4 w-4 mr-1" />
                              <span className="text-sm truncate">{box.location}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => printBoxLabel(box)}
                            >
                              <PrinterIcon className="h-4 w-4 mr-2" />
                              Print label
                            </Button>
                            <Link href={`/box/${box.id}`}>
                              <Button size="sm">View</Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Search Results */}
          {isSearching && (
            <Card>
              <CardHeader>
                <CardTitle>Items matching "{searchQuery}"</CardTitle>
              </CardHeader>
              <CardContent>
                {searchResults.length === 0 ? (
                  <p className="text-muted-foreground">No boxes found containing items matching "{searchQuery}"</p>
                ) : (
                  <div className="space-y-6">
                    {searchResults.map(({ box, items }) => (
                      <div key={box.id} className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold truncate">{box.name}</h3>
                            <div className="flex items-center text-muted-foreground">
                              <MapPinIcon className="h-4 w-4 mr-2" />
                              <span className="text-sm truncate">{box.location}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button variant="outline" onClick={() => printBoxLabel(box)}>
                              <PrinterIcon className="h-4 w-4 mr-2" />
                              Print label
                            </Button>
                            <Link href={`/box/${box.id}`}>
                              <Button>View Box</Button>
                            </Link>
                          </div>
                        </div>
                        {items.length > 0 && (
                          <div className="pl-4 border-l space-y-2">
                            <p className="text-sm font-medium text-muted-foreground mb-2">Exact matches:</p>
                            {items.map((item) => (
                              <div key={item.id} className="flex justify-between items-center">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  {item.description && (
                                    <p className="text-sm text-muted-foreground">{item.description}</p>
                                  )}
                                </div>
                                <EditItemDialog item={item} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Boxes Grid */}
          {!searchQuery && (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {sortedBoxes.map((box) => (
                <Card key={box.id} className="hover:border-primary transition-colors relative">
                  <CardContent className="p-6">
                    <div className="absolute top-6 right-6">
                      <SmallQrCode token={box.qrToken} />
                    </div>
                    <Link href={`/box/${box.id}`}>
                      <div className="flex flex-col gap-2 cursor-pointer pr-14">
                        <h3 className="text-lg font-semibold">{box.name}</h3>
                        <div className="flex items-center text-muted-foreground">
                          <MapPinIcon className="h-4 w-4 mr-2" />
                          <span className="text-sm">{box.location}</span>
                        </div>
                      </div>
                    </Link>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center text-sm text-muted-foreground" data-testid={`box-item-count-${box.id}`}>
                        <Package2Icon className="h-4 w-4 mr-1" />
                        <span>{box.itemCount} {box.itemCount === 1 ? "item" : "items"}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          printBoxLabel(box);
                        }}
                      >
                        <PrinterIcon className="h-4 w-4 mr-2" />
                        Print label
                      </Button>
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