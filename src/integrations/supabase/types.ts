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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_portal_credentials: {
        Row: {
          id: number
          password_hash: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          password_hash: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          password_hash?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          meal_cutoff_hour: number
          meal_cutoff_minute: number
          signup_enabled: boolean
          telegram_chat_id: string | null
          telegram_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          meal_cutoff_hour?: number
          meal_cutoff_minute?: number
          signup_enabled?: boolean
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          meal_cutoff_hour?: number
          meal_cutoff_minute?: number
          signup_enabled?: boolean
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      carry_logs: {
        Row: {
          created_at: string
          id: string
          inserted_count: number
          skipped_count: number
          source_date: string
          target_date: string
          total_active_users: number
          triggered_by: string
          updated_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          inserted_count?: number
          skipped_count?: number
          source_date: string
          target_date: string
          total_active_users?: number
          triggered_by?: string
          updated_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          inserted_count?: number
          skipped_count?: number
          source_date?: string
          target_date?: string
          total_active_users?: number
          triggered_by?: string
          updated_count?: number
        }
        Relationships: []
      }
      daily_meals: {
        Row: {
          created_at: string
          dinner: boolean
          dinner_extra_option: string | null
          dinner_off_today_only: boolean
          id: string
          lunch: boolean
          lunch_extra_option: string | null
          lunch_off_today_only: boolean
          meal_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dinner?: boolean
          dinner_extra_option?: string | null
          dinner_off_today_only?: boolean
          id?: string
          lunch?: boolean
          lunch_extra_option?: string | null
          lunch_off_today_only?: boolean
          meal_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dinner?: boolean
          dinner_extra_option?: string | null
          dinner_off_today_only?: boolean
          id?: string
          lunch?: boolean
          lunch_extra_option?: string | null
          lunch_off_today_only?: boolean
          meal_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      extra_meals: {
        Row: {
          added_by: string | null
          created_at: string
          extra_option: string | null
          id: string
          is_feast_day: boolean
          meal_count_equivalent: number
          meal_date: string
          meal_type: string
          quantity: number
          reason: string | null
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          extra_option?: string | null
          id?: string
          is_feast_day?: boolean
          meal_count_equivalent?: number
          meal_date?: string
          meal_type: string
          quantity?: number
          reason?: string | null
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          extra_option?: string | null
          id?: string
          is_feast_day?: boolean
          meal_count_equivalent?: number
          meal_date?: string
          meal_type?: string
          quantity?: number
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feast_day_config: {
        Row: {
          created_at: string
          created_by: string | null
          feast_date: string
          id: string
          meal_count_equivalent: number
          meal_type: string
          note: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          feast_date: string
          id?: string
          meal_count_equivalent?: number
          meal_type?: string
          note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          feast_date?: string
          id?: string
          meal_count_equivalent?: number
          meal_type?: string
          note?: string | null
        }
        Relationships: []
      }
      master_admin_credentials: {
        Row: {
          bound_user_id: string | null
          id: number
          login_id: string
          password_hash: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bound_user_id?: string | null
          id?: number
          login_id: string
          password_hash: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bound_user_id?: string | null
          id?: number
          login_id?: string
          password_hash?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      meal_months: {
        Row: {
          created_at: string
          end_date: string | null
          extra_charge: number
          id: string
          is_active: boolean
          manager_user_id: string | null
          meal_rate: number | null
          min_meals: number
          month: number
          start_date: string | null
          total_expense: number | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          extra_charge?: number
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          meal_rate?: number | null
          min_meals?: number
          month: number
          start_date?: string | null
          total_expense?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string | null
          extra_charge?: number
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          meal_rate?: number | null
          min_meals?: number
          month?: number
          start_date?: string | null
          total_expense?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      member_balances: {
        Row: {
          carry_forward: number
          created_at: string
          id: string
          meal_count_override: number | null
          month_id: string
          total_amount: number
          total_meals: number
          total_paid: number
          updated_at: string
          user_id: string
        }
        Insert: {
          carry_forward?: number
          created_at?: string
          id?: string
          meal_count_override?: number | null
          month_id: string
          total_amount?: number
          total_meals?: number
          total_paid?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          carry_forward?: number
          created_at?: string
          id?: string
          meal_count_override?: number | null
          month_id?: string
          total_amount?: number
          total_meals?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_balances_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "meal_months"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_codes: {
        Row: {
          code: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_verified: boolean
          month_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          user_id: string
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          is_verified?: boolean
          month_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          user_id: string
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_verified?: boolean
          month_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          user_id?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "meal_months"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          id: string
          is_active: boolean
          phone: string | null
          roll_number: string | null
          updated_at: string
          user_id: string
          year: Database["public"]["Enums"]["year_type"]
        }
        Insert: {
          created_at?: string
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          is_active?: boolean
          phone?: string | null
          roll_number?: string | null
          updated_at?: string
          user_id: string
          year?: Database["public"]["Enums"]["year_type"]
        }
        Update: {
          created_at?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"]
          id?: string
          is_active?: boolean
          phone?: string | null
          roll_number?: string | null
          updated_at?: string
          user_id?: string
          year?: Database["public"]["Enums"]["year_type"]
        }
        Relationships: []
      }
      special_day_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_date: string
          item_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_date: string
          item_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_date?: string
          item_name?: string
        }
        Relationships: []
      }
      special_day_responses: {
        Row: {
          created_at: string
          id: string
          item_id: string
          opted_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          opted_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          opted_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_day_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "special_day_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bind_master_admin_user: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_signup_enabled: { Args: never; Returns: boolean }
      set_admin_portal_password: {
        Args: { _new_password: string }
        Returns: undefined
      }
      set_master_admin_credentials: {
        Args: { _login_id: string; _new_password: string }
        Returns: undefined
      }
      verify_admin_portal_password: {
        Args: { _password: string }
        Returns: boolean
      }
      verify_master_admin: {
        Args: { _login_id: string; _password: string }
        Returns: string
      }
    }
    Enums: {
      gender_type: "male" | "female"
      user_role: "student" | "meal_manager" | "super_admin"
      year_type: "1st" | "2nd" | "3rd" | "4th" | "5th" | "extra"
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
      gender_type: ["male", "female"],
      user_role: ["student", "meal_manager", "super_admin"],
      year_type: ["1st", "2nd", "3rd", "4th", "5th", "extra"],
    },
  },
} as const
