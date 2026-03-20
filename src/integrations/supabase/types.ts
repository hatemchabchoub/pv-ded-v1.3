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
      attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          pv_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          pv_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          pv_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          id: string
          name_ar: string | null
          name_fr: string
          region: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          id?: string
          name_ar?: string | null
          name_fr: string
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          id?: string
          name_ar?: string | null
          name_fr?: string
          region?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_field_candidates: {
        Row: {
          confidence: number | null
          created_at: string | null
          extracted_value: string | null
          field_name: string
          id: string
          import_id: string
          normalized_value: string | null
          validated: boolean | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          extracted_value?: string | null
          field_name: string
          id?: string
          import_id: string
          normalized_value?: string | null
          validated?: boolean | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          extracted_value?: string | null
          field_name?: string
          id?: string
          import_id?: string
          normalized_value?: string | null
          validated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "document_field_candidates_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "document_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      document_imports: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          extracted_json: Json | null
          finished_at: string | null
          id: string
          import_type: string | null
          pv_id: string | null
          raw_text: string | null
          source_file_name: string | null
          started_at: string | null
          status: string | null
          storage_path: string | null
          uploaded_by: string | null
          validation_errors: Json | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          extracted_json?: Json | null
          finished_at?: string | null
          id?: string
          import_type?: string | null
          pv_id?: string | null
          raw_text?: string | null
          source_file_name?: string | null
          started_at?: string | null
          status?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
          validation_errors?: Json | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          extracted_json?: Json | null
          finished_at?: string | null
          id?: string
          import_type?: string | null
          pv_id?: string | null
          raw_text?: string | null
          source_file_name?: string | null
          started_at?: string | null
          status?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_imports_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv"
            referencedColumns: ["id"]
          },
        ]
      }
      fonctions: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          label_ar: string
          label_fr: string | null
          mapped_role: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          label_ar: string
          label_fr?: string | null
          mapped_role?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          label_ar?: string
          label_fr?: string | null
          mapped_role?: string | null
        }
        Relationships: []
      }
      goods_reference: {
        Row: {
          active: boolean | null
          category_ar: string | null
          category_fr: string
          created_at: string | null
          id: string
          type_ar: string | null
          type_fr: string | null
        }
        Insert: {
          active?: boolean | null
          category_ar?: string | null
          category_fr: string
          created_at?: string | null
          id?: string
          type_ar?: string | null
          type_fr?: string | null
        }
        Update: {
          active?: boolean | null
          category_ar?: string | null
          category_fr?: string
          created_at?: string | null
          id?: string
          type_ar?: string | null
          type_fr?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          read: boolean | null
          related_id: string | null
          related_table: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          related_id?: string | null
          related_table?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          related_id?: string | null
          related_table?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      offenders: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          display_order: number | null
          id: string
          identifier: string | null
          name_or_company: string
          person_type: string | null
          pv_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          identifier?: string | null
          name_or_company: string
          person_type?: string | null
          pv_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          identifier?: string | null
          name_or_company?: string
          person_type?: string | null
          pv_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offenders_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv"
            referencedColumns: ["id"]
          },
        ]
      }
      officers: {
        Row: {
          active: boolean | null
          auth_user_id: string | null
          badge_number: string | null
          created_at: string | null
          department_id: string | null
          fonction: string | null
          full_name: string
          generated_email: string | null
          id: string
          initial_password: string | null
          rank_label: string | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          auth_user_id?: string | null
          badge_number?: string | null
          created_at?: string | null
          department_id?: string | null
          fonction?: string | null
          full_name: string
          generated_email?: string | null
          id?: string
          initial_password?: string | null
          rank_label?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          auth_user_id?: string | null
          badge_number?: string | null
          created_at?: string | null
          department_id?: string | null
          fonction?: string | null
          full_name?: string
          generated_email?: string | null
          id?: string
          initial_password?: string | null
          rank_label?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          auth_user_id: string
          created_at: string | null
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          auth_user_id: string
          created_at?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          auth_user_id?: string
          created_at?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      pv: {
        Row: {
          ai_analysis_report: string | null
          case_status: string | null
          created_at: string | null
          created_by: string | null
          currency_violation: boolean | null
          customs_violation: boolean | null
          department_id: string | null
          id: string
          internal_reference: string | null
          notes: string | null
          officer_id: string | null
          parent_pv_id: string | null
          priority_level: string | null
          public_law_violation: boolean | null
          pv_date: string
          pv_number: string
          pv_type: string | null
          referral_source_id: string | null
          referral_type: string | null
          seizure_renewal: boolean | null
          source_import_type: string | null
          total_actual_seizure: number | null
          total_precautionary_seizure: number | null
          total_seizure: number | null
          total_virtual_seizure: number | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          ai_analysis_report?: string | null
          case_status?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_violation?: boolean | null
          customs_violation?: boolean | null
          department_id?: string | null
          id?: string
          internal_reference?: string | null
          notes?: string | null
          officer_id?: string | null
          parent_pv_id?: string | null
          priority_level?: string | null
          public_law_violation?: boolean | null
          pv_date?: string
          pv_number: string
          pv_type?: string | null
          referral_source_id?: string | null
          referral_type?: string | null
          seizure_renewal?: boolean | null
          source_import_type?: string | null
          total_actual_seizure?: number | null
          total_precautionary_seizure?: number | null
          total_seizure?: number | null
          total_virtual_seizure?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_analysis_report?: string | null
          case_status?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_violation?: boolean | null
          customs_violation?: boolean | null
          department_id?: string | null
          id?: string
          internal_reference?: string | null
          notes?: string | null
          officer_id?: string | null
          parent_pv_id?: string | null
          priority_level?: string | null
          public_law_violation?: boolean | null
          pv_date?: string
          pv_number?: string
          pv_type?: string | null
          referral_source_id?: string | null
          referral_type?: string | null
          seizure_renewal?: boolean | null
          source_import_type?: string | null
          total_actual_seizure?: number | null
          total_precautionary_seizure?: number | null
          total_seizure?: number | null
          total_virtual_seizure?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pv_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_parent_pv_id_fkey"
            columns: ["parent_pv_id"]
            isOneToOne: false
            referencedRelation: "pv"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_referral_source_id_fkey"
            columns: ["referral_source_id"]
            isOneToOne: false
            referencedRelation: "referral_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_sources: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          label_ar: string | null
          label_fr: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          label_ar?: string | null
          label_fr: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          label_ar?: string | null
          label_fr?: string
        }
        Relationships: []
      }
      seizures: {
        Row: {
          created_at: string | null
          display_order: number | null
          estimated_value: number | null
          goods_category: string | null
          goods_type: string | null
          id: string
          pv_id: string
          quantity: number | null
          seizure_type: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          estimated_value?: number | null
          goods_category?: string | null
          goods_type?: string | null
          id?: string
          pv_id: string
          quantity?: number | null
          seizure_type?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          estimated_value?: number | null
          goods_category?: string | null
          goods_type?: string | null
          id?: string
          pv_id?: string
          quantity?: number | null
          seizure_type?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seizures_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          department_id: string | null
          id: string
          name_ar: string | null
          name_fr: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          name_ar?: string | null
          name_fr: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          department_id?: string | null
          id?: string
          name_ar?: string | null
          name_fr?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      violation_reference: {
        Row: {
          active: boolean | null
          category: string | null
          code: string | null
          created_at: string | null
          id: string
          label_ar: string | null
          label_fr: string
          legal_basis: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          label_ar?: string | null
          label_fr: string
          legal_basis?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          label_ar?: string | null
          label_fr?: string
          legal_basis?: string | null
        }
        Relationships: []
      }
      violations: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          legal_basis: string | null
          pv_id: string
          severity_level: string | null
          violation_category: string | null
          violation_label: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          legal_basis?: string | null
          pv_id: string
          severity_level?: string | null
          violation_category?: string | null
          violation_label: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          legal_basis?: string | null
          pv_id?: string
          severity_level?: string | null
          violation_category?: string | null
          violation_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "violations_pv_id_fkey"
            columns: ["pv_id"]
            isOneToOne: false
            referencedRelation: "pv"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_user_roles: {
        Args: { _roles: string[]; _target_user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "national_supervisor"
        | "department_supervisor"
        | "officer"
        | "viewer"
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
      app_role: [
        "admin",
        "national_supervisor",
        "department_supervisor",
        "officer",
        "viewer",
      ],
    },
  },
} as const
