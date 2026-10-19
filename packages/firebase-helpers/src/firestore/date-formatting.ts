export type DateFormat = 
  | "PPP"           // Jan 1, 2024
  | "PPpp"          // Jan 1, 2024, 12:00 PM
  | "MM/dd/yyyy"    // 01/01/2024
  | "yyyy-MM-dd"    // 2024-01-01
  | "MMM d, yyyy"   // Jan 1, 2024
  | "MMMM d, yyyy"  // January 1, 2024
  | "h:mm a"        // 12:00 PM
  | "HH:mm"         // 13:00
  | string;         // Allow custom format strings
