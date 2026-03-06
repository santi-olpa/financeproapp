export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          alias: string | null
          cbu_cvu: string | null
          color: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          current_balance: number
          icon: string | null
          id: string
          initial_balance: number
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          alias?: string | null
          cbu_cvu?: string | null
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          current_balance?: number
          icon?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          alias?: string | null
          cbu_cvu?: string | null
          color?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          current_balance?: number
          icon?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_type: Database["public"]["Enums"]["category_type"]
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          parent_id: string | null
          user_id: string | null
        }
        Insert: {
          category_type: Database["public"]["Enums"]["category_type"]
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          parent_id?: string | null
          user_id?: string | null
        }
        Update: {
          category_type?: Database["public"]["Enums"]["category_type"]
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          parent_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          is_paid: boolean | null
          paid_date: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          is_paid?: boolean | null
          paid_date?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          is_paid?: boolean | null
          paid_date?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_snapshots: {
        Row: {
          created_at: string
          id: string
          net_balance_ars: number | null
          net_balance_usd: number | null
          period_month: number
          period_year: number
          total_expense_ars: number | null
          total_expense_usd: number | null
          total_income_ars: number | null
          total_income_usd: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          net_balance_ars?: number | null
          net_balance_usd?: number | null
          period_month: number
          period_year: number
          total_expense_ars?: number | null
          total_expense_usd?: number | null
          total_income_ars?: number | null
          total_income_usd?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          net_balance_ars?: number | null
          net_balance_usd?: number | null
          period_month?: number
          period_year?: number
          total_expense_ars?: number | null
          total_expense_usd?: number | null
          total_income_ars?: number | null
          total_income_usd?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_currency: Database["public"]["Enums"]["currency_type"] | null
          full_name: string | null
          hide_amounts: boolean | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_type"] | null
          full_name?: string | null
          hide_amounts?: boolean | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: Database["public"]["Enums"]["currency_type"] | null
          full_name?: string | null
          hide_amounts?: boolean | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          description: string | null
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          last_generated_date: string | null
          name: string
          next_due_date: string
          notes: string | null
          price_history: Json | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          description?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          name: string
          next_due_date: string
          notes?: string | null
          price_history?: Json | null
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          description?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          name?: string
          next_due_date?: string
          notes?: string | null
          price_history?: Json | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          current_installment: number | null
          description: string | null
          destination_account_id: string | null
          has_installments: boolean | null
          id: string
          notes: string | null
          parent_transaction_id: string | null
          recurring_expense_id: string | null
          source_account_id: string | null
          total_installments: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_type"]
          current_installment?: number | null
          description?: string | null
          destination_account_id?: string | null
          has_installments?: boolean | null
          id?: string
          notes?: string | null
          parent_transaction_id?: string | null
          recurring_expense_id?: string | null
          source_account_id?: string | null
          total_installments?: number | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          current_installment?: number | null
          description?: string | null
          destination_account_id?: string | null
          has_installments?: boolean | null
          id?: string
          notes?: string | null
          parent_transaction_id?: string | null
          recurring_expense_id?: string | null
          source_account_id?: string | null
          total_installments?: number | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_patrimony_history: {
        Args: { p_currency?: string; p_months?: number; p_user_id: string }
        Returns: {
          cumulative_patrimony: number
          net_change: number
          period_month: number
          period_year: number
          total_expense: number
          total_income: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalculate_account_balance: {
        Args: { p_account_id: string }
        Returns: number
      }
      recalculate_all_account_balances: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "bank" | "wallet" | "cash" | "investment" | "crypto"
      app_role: "admin" | "user"
      category_type: "income" | "expense"
      currency_type: "ARS" | "USD"
      transaction_type: "income" | "expense" | "transfer" | "adjustment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["bank", "wallet", "cash", "investment", "crypto"],
      app_role: ["admin", "user"],
      category_type: ["income", "expense"],
      currency_type: ["ARS", "USD"],
      transaction_type: ["income", "expense", "transfer", "adjustment"],
    },
  },
} as const
