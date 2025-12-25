// src/lib/database.types.ts
export type Database = {
  public: {
    Tables: {
      contact_inquiries: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          email: string;
          project_type: string | null;
          budget: string | null;
          timeline: string | null;
          message: string | null;
          user_agent: string | null;
          referrer: string | null;
          page_url: string | null;
          status: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          email: string;
          project_type?: string | null;
          budget?: string | null;
          timeline?: string | null;
          message?: string | null;
          user_agent?: string | null;
          referrer?: string | null;
          page_url?: string | null;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contact_inquiries"]["Insert"]>;
      };
    };
  };
};
