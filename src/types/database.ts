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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      api_audit_log: {
        Row: {
          api_key_id: string | null
          at: string
          id: number
          ip: string | null
          method: string
          path: string
          status: number
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          at?: string
          id?: number
          ip?: string | null
          method: string
          path: string
          status: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          at?: string
          id?: number
          ip?: string | null
          method?: string
          path?: string
          status?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_audit_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scope: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          scope: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          id: string
          kind: string
          label: string | null
          mime_type: string | null
          public_url: string | null
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          id?: string
          kind?: string
          label?: string | null
          mime_type?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          id?: string
          kind?: string
          label?: string | null
          mime_type?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["comm_channel"]
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          direction: Database["public"]["Enums"]["comm_direction"]
          external_id: string | null
          id: string
          metadata: Json | null
          project_id: string | null
          received_at: string
          recipient: string | null
          replied_at: string | null
          replied_by: string | null
          reply_due_at: string | null
          requires_reply: boolean
          sender: string
          sla_state: Database["public"]["Enums"]["sla_state"]
          subject: string | null
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["comm_channel"]
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction: Database["public"]["Enums"]["comm_direction"]
          external_id?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          received_at: string
          recipient?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply_due_at?: string | null
          requires_reply?: boolean
          sender: string
          sla_state?: Database["public"]["Enums"]["sla_state"]
          subject?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["comm_channel"]
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: Database["public"]["Enums"]["comm_direction"]
          external_id?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          received_at?: string
          recipient?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply_due_at?: string | null
          requires_reply?: boolean
          sender?: string
          sla_state?: Database["public"]["Enums"]["sla_state"]
          subject?: string | null
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          business_hours_end: string
          business_hours_start: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          timezone: string
          type: Database["public"]["Enums"]["company_type"]
          updated_at: string
        }
        Insert: {
          business_hours_end?: string
          business_hours_start?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          timezone?: string
          type?: Database["public"]["Enums"]["company_type"]
          updated_at?: string
        }
        Update: {
          business_hours_end?: string
          business_hours_start?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          timezone?: string
          type?: Database["public"]["Enums"]["company_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          role: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_access_log: {
        Row: {
          access_type: string
          accessed_at: string
          accessed_by: string | null
          credential_id: string
          id: string
          ip_address: unknown
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_at?: string
          accessed_by?: string | null
          credential_id: string
          id?: string
          ip_address?: unknown
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_at?: string
          accessed_by?: string | null
          credential_id?: string
          id?: string
          ip_address?: unknown
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_access_log_accessed_by_fkey"
            columns: ["accessed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_access_log_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          credential_type: Database["public"]["Enums"]["credential_type"]
          encrypted_value: string
          encryption_version: number
          expires_at: string | null
          id: string
          is_active: boolean
          label: string
          last_rotated_at: string | null
          notes_encrypted: string | null
          project_id: string | null
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          credential_type: Database["public"]["Enums"]["credential_type"]
          encrypted_value: string
          encryption_version?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label: string
          last_rotated_at?: string | null
          notes_encrypted?: string | null
          project_id?: string | null
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          credential_type?: Database["public"]["Enums"]["credential_type"]
          encrypted_value?: string
          encryption_version?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_rotated_at?: string | null
          notes_encrypted?: string | null
          project_id?: string | null
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company_id: string
          contact_id: string | null
          created_at: string
          description: string | null
          external_ghl_id: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          owner_id: string | null
          source: Database["public"]["Enums"]["deal_source"]
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at: string
          value_inr: number | null
          value_usd: number | null
          won_at: string | null
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          external_ghl_id?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_id?: string | null
          source?: Database["public"]["Enums"]["deal_source"]
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at?: string
          value_inr?: number | null
          value_usd?: number | null
          won_at?: string | null
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          external_ghl_id?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          owner_id?: string | null
          source?: Database["public"]["Enums"]["deal_source"]
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          updated_at?: string
          value_inr?: number | null
          value_usd?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          client_visible: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          sequence: number
          status: Database["public"]["Enums"]["milestone_status"]
          target_date: string | null
          updated_at: string
        }
        Insert: {
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          sequence: number
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          sequence?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          contact_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          id: string
          kind: string
          note: string | null
          project_id: string | null
          received_at: string | null
          recorded_by: string | null
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          id?: string
          kind?: string
          note?: string | null
          project_id?: string | null
          received_at?: string | null
          recorded_by?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          id?: string
          kind?: string
          note?: string | null
          project_id?: string | null
          received_at?: string | null
          recorded_by?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_end_at: string | null
          client_visible: boolean
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          expected_end_at: string | null
          id: string
          name: string
          pm_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          actual_end_at?: string | null
          client_visible?: boolean
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          expected_end_at?: string | null
          id?: string
          name: string
          pm_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          actual_end_at?: string | null
          client_visible?: boolean
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          expected_end_at?: string | null
          id?: string
          name?: string
          pm_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_pm_id_fkey"
            columns: ["pm_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_members: {
        Row: {
          added_at: string
          added_by: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_breaches: {
        Row: {
          communication_id: string
          created_at: string
          id: string
          notified_at: string
          notified_user_ids: string[]
          resolution_note: string | null
          resolved_at: string | null
          tier: number
        }
        Insert: {
          communication_id: string
          created_at?: string
          id?: string
          notified_at?: string
          notified_user_ids?: string[]
          resolution_note?: string | null
          resolved_at?: string | null
          tier: number
        }
        Update: {
          communication_id?: string
          created_at?: string
          id?: string
          notified_at?: string
          notified_user_ids?: string[]
          resolution_note?: string | null
          resolved_at?: string | null
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_breaches_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_rules: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          respect_business_hours: boolean
          tier_1_minutes: number
          tier_2_minutes: number
          tier_3_minutes: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          respect_business_hours?: boolean
          tier_1_minutes?: number
          tier_2_minutes?: number
          tier_3_minutes?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          respect_business_hours?: boolean
          tier_1_minutes?: number
          tier_2_minutes?: number
          tier_3_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          assignee_id: string | null
          client_visible: boolean
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_at: string | null
          estimate_hours: number | null
          id: string
          milestone_id: string | null
          pm_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assignee_id?: string | null
          client_visible?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          estimate_hours?: number | null
          id?: string
          milestone_id?: string | null
          pm_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assignee_id?: string | null
          client_visible?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_at?: string | null
          estimate_hours?: number | null
          id?: string
          milestone_id?: string | null
          pm_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_pm_id_fkey"
            columns: ["pm_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          deleted_at: string | null
          email: string
          id: string
          is_active: boolean
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deleted_at?: string | null
          email: string
          id: string
          is_active?: boolean
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deleted_at?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      user_has_task_in_project: {
        Args: { target_project_id: string }
        Returns: boolean
      }
    }
    Enums: {
      comm_channel:
        | "outlook"
        | "whatsapp"
        | "upwork"
        | "slack"
        | "email"
        | "sms"
        | "phone"
      comm_direction: "inbound" | "outbound"
      company_type: "client" | "prospect" | "partner"
      credential_type:
        | "cms"
        | "hosting"
        | "social_media"
        | "email"
        | "analytics"
        | "database"
        | "api_key"
        | "other"
      deal_source: "upwork" | "linkedin" | "referral" | "inbound" | "other"
      deal_stage:
        | "new"
        | "qualified"
        | "proposal_sent"
        | "negotiation"
        | "won"
        | "lost"
      milestone_status: "not_started" | "in_progress" | "completed" | "blocked"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      sla_state:
        | "none"
        | "pending"
        | "breached_l1"
        | "breached_l2"
        | "breached_l3"
        | "resolved"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "review" | "done" | "blocked"
      user_role: "admin" | "sales" | "pm" | "developer" | "client"
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
      comm_channel: [
        "outlook",
        "whatsapp",
        "upwork",
        "slack",
        "email",
        "sms",
        "phone",
      ],
      comm_direction: ["inbound", "outbound"],
      company_type: ["client", "prospect", "partner"],
      credential_type: [
        "cms",
        "hosting",
        "social_media",
        "email",
        "analytics",
        "database",
        "api_key",
        "other",
      ],
      deal_source: ["upwork", "linkedin", "referral", "inbound", "other"],
      deal_stage: [
        "new",
        "qualified",
        "proposal_sent",
        "negotiation",
        "won",
        "lost",
      ],
      milestone_status: ["not_started", "in_progress", "completed", "blocked"],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      sla_state: [
        "none",
        "pending",
        "breached_l1",
        "breached_l2",
        "breached_l3",
        "resolved",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "done", "blocked"],
      user_role: ["admin", "sales", "pm", "developer", "client"],
    },
  },
} as const
