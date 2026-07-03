import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="mt-auto py-8 border-t bg-muted/30">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
        <div className="flex flex-col items-center md:items-start gap-1">
          <div className="font-medium text-foreground">
            &copy; 2026 <a href="https://boxtracker.net" className="hover:text-primary transition-colors" target="_blank" rel="noreferrer">boxtracker.net</a>
          </div>
          <div>All rights reserved.</div>
        </div>
        
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          <Link href="/support" className="hover:text-primary transition-colors">Help & Support</Link>
          <a href="mailto:contact@boxtracker.net" className="hover:text-primary transition-colors">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
