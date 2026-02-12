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
      analyses: {
        Row: {
          ai_interpretation: string | null
          apa_results: string | null
          config: Json | null
          created_at: string
          current_step: number
          dataset_id: string
          discussion: string | null
          hypothesis: string | null
          id: string
          is_pro_analysis: boolean | null
          project_id: string
          research_question: string | null
          results: Json | null
          selected_variables: Json | null
          status: Database["public"]["Enums"]["analysis_status"]
          test_category: string | null
          test_type: string | null
          updated_at: string
        }
        Insert: {
          ai_interpretation?: string | null
          apa_results?: string | null
          config?: Json | null
          created_at?: string
          current_step?: number
          dataset_id: string
          discussion?: string | null
          hypothesis?: string | null
          id?: string
          is_pro_analysis?: boolean | null
          project_id: string
          research_question?: string | null
          results?: Json | null
          selected_variables?: Json | null
          status?: Database["public"]["Enums"]["analysis_status"]
          test_category?: string | null
          test_type?: string | null
          updated_at?: string
        }
        Update: {
          ai_interpretation?: string | null
          apa_results?: string | null
          config?: Json | null
          created_at?: string
          current_step?: number
          dataset_id?: string
          discussion?: string | null
          hypothesis?: string | null
          id?: string
          is_pro_analysis?: boolean | null
          project_id?: string
          research_question?: string | null
          results?: Json | null
          selected_variables?: Json | null
          status?: Database["public"]["Enums"]["analysis_status"]
          test_category?: string | null
          test_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_blocks: {
        Row: {
          analysis_id: string
          assumptions: Json | null
          config: Json
          created_at: string
          dependent_variables: string[]
          display_order: number
          grouping_variable: string | null
          id: string
          independent_variables: string[]
          linked_hypothesis_id: string | null
          narrative: Json | null
          results: Json | null
          section: string
          section_id: string
          status: string
          test_category: string
          test_type: string
          updated_at: string
        }
        Insert: {
          analysis_id: string
          assumptions?: Json | null
          config?: Json
          created_at?: string
          dependent_variables?: string[]
          display_order?: number
          grouping_variable?: string | null
          id?: string
          independent_variables?: string[]
          linked_hypothesis_id?: string | null
          narrative?: Json | null
          results?: Json | null
          section?: string
          section_id?: string
          status?: string
          test_category: string
          test_type: string
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          assumptions?: Json | null
          config?: Json
          created_at?: string
          dependent_variables?: string[]
          display_order?: number
          grouping_variable?: string | null
          id?: string
          independent_variables?: string[]
          linked_hypothesis_id?: string | null
          narrative?: Json | null
          results?: Json | null
          section?: string
          section_id?: string
          status?: string
          test_category?: string
          test_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_blocks_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_categories: {
        Row: {
          category_id: string
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_enabled: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      analysis_tests: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_enabled: boolean | null
          is_pro_only: boolean | null
          name: string
          required_variables: Json | null
          test_id: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          is_pro_only?: boolean | null
          name: string
          required_variables?: Json | null
          test_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          is_pro_only?: boolean | null
          name?: string
          required_variables?: Json | null
          test_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      auto_reply_rules: {
        Row: {
          ai_enabled: boolean | null
          created_at: string | null
          custom_response: string | null
          enabled: boolean | null
          id: string
          keywords: string[] | null
          name: string
          priority: number | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          ai_enabled?: boolean | null
          created_at?: string | null
          custom_response?: string | null
          enabled?: boolean | null
          id?: string
          keywords?: string[] | null
          name: string
          priority?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_enabled?: boolean | null
          created_at?: string | null
          custom_response?: string | null
          enabled?: boolean | null
          id?: string
          keywords?: string[] | null
          name?: string
          priority?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_reply_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          ai_qa: Json | null
          ai_summary: string | null
          author_id: string
          authority_statement: string | null
          category_id: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          meta_description: string | null
          meta_keywords: string[] | null
          meta_title: string | null
          publish_date: string | null
          reading_time: number | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          ai_qa?: Json | null
          ai_summary?: string | null
          author_id: string
          authority_statement?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          publish_date?: string | null
          reading_time?: number | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          ai_qa?: Json | null
          ai_summary?: string | null
          author_id?: string
          authority_statement?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          meta_description?: string | null
          meta_keywords?: string[] | null
          meta_title?: string | null
          publish_date?: string | null
          reading_time?: number | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string | null
          email: string
          error_message: string | null
          id: string
          name: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id?: string | null
          email: string
          error_message?: string | null
          id?: string
          name?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string | null
          email?: string
          error_message?: string | null
          id?: string
          name?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          dataset_context_id: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          dataset_context_id?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          dataset_context_id?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_dataset_context_id_fkey"
            columns: ["dataset_context_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          column_count: number | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string | null
          id: string
          parsed_at: string | null
          project_id: string
          raw_data: Json | null
          row_count: number | null
        }
        Insert: {
          column_count?: number | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url?: string | null
          id?: string
          parsed_at?: string | null
          project_id: string
          raw_data?: Json | null
          row_count?: number | null
        }
        Update: {
          column_count?: number | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string | null
          id?: string
          parsed_at?: string | null
          project_id?: string
          raw_data?: Json | null
          row_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          account_name: string
          created_at: string | null
          email_address: string
          enable_tls: boolean | null
          id: string
          imap_host: string | null
          imap_password: string | null
          imap_port: number | null
          imap_username: string | null
          is_active: boolean | null
          is_default: boolean | null
          last_tested_at: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_username: string | null
          test_status: string | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          created_at?: string | null
          email_address: string
          enable_tls?: boolean | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_username?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          last_tested_at?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          created_at?: string | null
          email_address?: string
          enable_tls?: boolean | null
          id?: string
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_username?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          last_tested_at?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          body: string | null
          created_at: string | null
          email_account_id: string | null
          failed_count: number | null
          html_content: string | null
          id: string
          name: string
          sent_at: string | null
          sent_count: number | null
          status: string | null
          subject: string
          total_recipients: number | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          email_account_id?: string | null
          failed_count?: number | null
          html_content?: string | null
          id?: string
          name: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject: string
          total_recipients?: number | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          email_account_id?: string | null
          failed_count?: number | null
          html_content?: string | null
          id?: string
          name?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          subject?: string
          total_recipients?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_configurations: {
        Row: {
          active: boolean | null
          check_interval: number | null
          created_at: string | null
          enable_auto_reply: boolean | null
          enable_tls: boolean | null
          from_email: string | null
          from_name: string | null
          host: string | null
          id: string
          password: string | null
          port: number | null
          type: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          active?: boolean | null
          check_interval?: number | null
          created_at?: string | null
          enable_auto_reply?: boolean | null
          enable_tls?: boolean | null
          from_email?: string | null
          from_name?: string | null
          host?: string | null
          id?: string
          password?: string | null
          port?: number | null
          type: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean | null
          check_interval?: number | null
          created_at?: string | null
          enable_auto_reply?: boolean | null
          enable_tls?: boolean | null
          from_email?: string | null
          from_name?: string | null
          host?: string | null
          id?: string
          password?: string | null
          port?: number | null
          type?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      hypotheses: {
        Row: {
          ai_explanation: string | null
          analysis_id: string
          assumptions_acknowledged: boolean | null
          created_at: string
          dependent_vars: string[]
          direction: string | null
          display_order: number | null
          hypothesis_id: string
          hypothesis_type: string
          id: string
          independent_vars: string[]
          null_hypothesis: string | null
          priority: string | null
          quality_status: string | null
          resolved_test: string | null
          statement: string
          status: string | null
          updated_at: string
        }
        Insert: {
          ai_explanation?: string | null
          analysis_id: string
          assumptions_acknowledged?: boolean | null
          created_at?: string
          dependent_vars?: string[]
          direction?: string | null
          display_order?: number | null
          hypothesis_id: string
          hypothesis_type?: string
          id?: string
          independent_vars?: string[]
          null_hypothesis?: string | null
          priority?: string | null
          quality_status?: string | null
          resolved_test?: string | null
          statement: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          ai_explanation?: string | null
          analysis_id?: string
          assumptions_acknowledged?: boolean | null
          created_at?: string
          dependent_vars?: string[]
          direction?: string | null
          display_order?: number | null
          hypothesis_id?: string
          hypothesis_type?: string
          id?: string
          independent_vars?: string[]
          null_hypothesis?: string | null
          priority?: string | null
          quality_status?: string | null
          resolved_test?: string | null
          statement?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hypotheses_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_emails: {
        Row: {
          auto_replied: boolean | null
          body: string | null
          email_account_id: string | null
          from_email: string
          id: string
          processed: boolean | null
          received_at: string | null
          replied_at: string | null
          reply_body: string | null
          subject: string | null
        }
        Insert: {
          auto_replied?: boolean | null
          body?: string | null
          email_account_id?: string | null
          from_email: string
          id?: string
          processed?: boolean | null
          received_at?: string | null
          replied_at?: string | null
          reply_body?: string | null
          subject?: string | null
        }
        Update: {
          auto_replied?: boolean | null
          body?: string | null
          email_account_id?: string | null
          from_email?: string
          id?: string
          processed?: boolean | null
          received_at?: string | null
          replied_at?: string | null
          reply_body?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incoming_emails_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          language: string | null
          plan: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          language?: string | null
          plan?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          language?: string | null
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          analysis_id: string
          created_at: string
          file_url: string | null
          format: string
          id: string
          include_charts: boolean | null
          include_tables: boolean | null
          sections_included: Json | null
          title: string
          user_id: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          file_url?: string | null
          format: string
          id?: string
          include_charts?: boolean | null
          include_tables?: boolean | null
          sections_included?: Json | null
          title: string
          user_id: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          file_url?: string | null
          format?: string
          id?: string
          include_charts?: boolean | null
          include_tables?: boolean | null
          sections_included?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variables: {
        Row: {
          column_index: number
          created_at: string
          dataset_id: string
          decimals: number | null
          id: string
          label: string | null
          measure: string | null
          missing_values: Json | null
          name: string
          role: string | null
          scale_group: string | null
          type: string
          updated_at: string
          value_labels: Json | null
          width: number | null
        }
        Insert: {
          column_index: number
          created_at?: string
          dataset_id: string
          decimals?: number | null
          id?: string
          label?: string | null
          measure?: string | null
          missing_values?: Json | null
          name: string
          role?: string | null
          scale_group?: string | null
          type?: string
          updated_at?: string
          value_labels?: Json | null
          width?: number | null
        }
        Update: {
          column_index?: number
          created_at?: string
          dataset_id?: string
          decimals?: number | null
          id?: string
          label?: string | null
          measure?: string | null
          missing_values?: Json | null
          name?: string
          role?: string | null
          scale_group?: string | null
          type?: string
          updated_at?: string
          value_labels?: Json | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "variables_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_blog_view_count: {
        Args: { post_id: string }
        Returns: undefined
      }
    }
    Enums: {
      analysis_status:
        | "draft"
        | "configuring"
        | "running"
        | "completed"
        | "failed"
      app_role: "admin" | "moderator" | "user"
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
      analysis_status: [
        "draft",
        "configuring",
        "running",
        "completed",
        "failed",
      ],
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
