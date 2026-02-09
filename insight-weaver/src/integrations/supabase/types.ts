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
      analysis_selections: {
        Row: {
          analysis_type: string
          complexity: string | null
          created_at: string
          description: string | null
          id: string
          is_selected: boolean | null
          reasoning: string | null
          selected_columns: string[] | null
          session_id: string
          title: string | null
        }
        Insert: {
          analysis_type: string
          complexity?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_selected?: boolean | null
          reasoning?: string | null
          selected_columns?: string[] | null
          session_id: string
          title?: string | null
        }
        Update: {
          analysis_type?: string
          complexity?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_selected?: boolean | null
          reasoning?: string | null
          selected_columns?: string[] | null
          session_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_selections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workflow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      derived_variables: {
        Row: {
          created_at: string
          description: string | null
          formula: string
          id: string
          is_enabled: boolean | null
          name: string
          session_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          formula: string
          id?: string
          is_enabled?: boolean | null
          name: string
          session_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          formula?: string
          id?: string
          is_enabled?: boolean | null
          name?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "derived_variables_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workflow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_structures: {
        Row: {
          created_at: string
          id: string
          outcome_event: string
          response_event: string
          session_id: string
          trial_onset_event: string
          trials_detected: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          outcome_event?: string
          response_event?: string
          session_id: string
          trial_onset_event?: string
          trials_detected?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          outcome_event?: string
          response_event?: string
          session_id?: string
          trial_onset_event?: string
          trials_detected?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_structures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workflow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_files: {
        Row: {
          column_names: string[] | null
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          row_count: number | null
          session_id: string
          storage_path: string | null
        }
        Insert: {
          column_names?: string[] | null
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          id?: string
          row_count?: number | null
          session_id: string
          storage_path?: string | null
        }
        Update: {
          column_names?: string[] | null
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          row_count?: number | null
          session_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workflow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_sessions: {
        Row: {
          created_at: string
          current_step: number
          distribution_type: string | null
          has_outliers: boolean | null
          id: string
          outlier_notes: string | null
          research_question: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          distribution_type?: string | null
          has_outliers?: boolean | null
          id?: string
          outlier_notes?: string | null
          research_question?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: number
          distribution_type?: string | null
          has_outliers?: boolean | null
          id?: string
          outlier_notes?: string | null
          research_question?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      wrangling_configs: {
        Row: {
          consistency_checks: Json | null
          created_at: string
          critical_variables: string[] | null
          datasets: Json | null
          id: string
          is_complete: boolean | null
          join_keys: Json | null
          join_warnings: Json | null
          missing_data_strategy: Json | null
          optional_variables: string[] | null
          session_id: string
          transformations: Json | null
          updated_at: string
        }
        Insert: {
          consistency_checks?: Json | null
          created_at?: string
          critical_variables?: string[] | null
          datasets?: Json | null
          id?: string
          is_complete?: boolean | null
          join_keys?: Json | null
          join_warnings?: Json | null
          missing_data_strategy?: Json | null
          optional_variables?: string[] | null
          session_id: string
          transformations?: Json | null
          updated_at?: string
        }
        Update: {
          consistency_checks?: Json | null
          created_at?: string
          critical_variables?: string[] | null
          datasets?: Json | null
          id?: string
          is_complete?: boolean | null
          join_keys?: Json | null
          join_warnings?: Json | null
          missing_data_strategy?: Json | null
          optional_variables?: string[] | null
          session_id?: string
          transformations?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wrangling_configs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workflow_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
