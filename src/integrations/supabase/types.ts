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
      cedula_verifications: {
        Row: {
          anio_registro: number | null
          cedula_number: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          id: string
          institucion: string | null
          is_claimed: boolean | null
          is_verified: boolean | null
          materno: string | null
          nombre: string | null
          paterno: string | null
          raw_response: Json | null
          titulo: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          anio_registro?: number | null
          cedula_number: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          institucion?: string | null
          is_claimed?: boolean | null
          is_verified?: boolean | null
          materno?: string | null
          nombre?: string | null
          paterno?: string | null
          raw_response?: Json | null
          titulo?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          anio_registro?: number | null
          cedula_number?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          institucion?: string | null
          is_claimed?: boolean | null
          is_verified?: boolean | null
          materno?: string | null
          nombre?: string | null
          paterno?: string | null
          raw_response?: Json | null
          titulo?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          is_double_check: boolean
          last_message: string | null
          last_message_at: string | null
          original_consultation_id: string | null
          participant1_id: string
          participant1_type: Database["public"]["Enums"]["chat_participant_type"]
          participant2_id: string
          participant2_type: Database["public"]["Enums"]["chat_participant_type"]
          status: Database["public"]["Enums"]["chat_status"]
          unread_count_1: number
          unread_count_2: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_double_check?: boolean
          last_message?: string | null
          last_message_at?: string | null
          original_consultation_id?: string | null
          participant1_id: string
          participant1_type: Database["public"]["Enums"]["chat_participant_type"]
          participant2_id: string
          participant2_type: Database["public"]["Enums"]["chat_participant_type"]
          status?: Database["public"]["Enums"]["chat_status"]
          unread_count_1?: number
          unread_count_2?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_double_check?: boolean
          last_message?: string | null
          last_message_at?: string | null
          original_consultation_id?: string | null
          participant1_id?: string
          participant1_type?: Database["public"]["Enums"]["chat_participant_type"]
          participant2_id?: string
          participant2_type?: Database["public"]["Enums"]["chat_participant_type"]
          status?: Database["public"]["Enums"]["chat_status"]
          unread_count_1?: number
          unread_count_2?: number
        }
        Relationships: []
      }
      clinical_session_invitations: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          responded_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["clinical_session_status"]
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          responded_at?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["clinical_session_status"]
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          responded_at?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["clinical_session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clinical_session_invitations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "clinical_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_sessions: {
        Row: {
          case_summary: string | null
          created_at: string
          description: string | null
          id: string
          organizer_id: string
          scheduled_at: string | null
          specialty: string
          status: Database["public"]["Enums"]["clinical_session_status"]
          title: string
          updated_at: string
        }
        Insert: {
          case_summary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organizer_id: string
          scheduled_at?: string | null
          specialty: string
          status?: Database["public"]["Enums"]["clinical_session_status"]
          title: string
          updated_at?: string
        }
        Update: {
          case_summary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organizer_id?: string
          scheduled_at?: string | null
          specialty?: string
          status?: Database["public"]["Enums"]["clinical_session_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultation_ratings: {
        Row: {
          comment: string | null
          consultation_id: string
          created_at: string
          doctor_id: string
          id: string
          patient_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          consultation_id: string
          created_at?: string
          doctor_id: string
          id?: string
          patient_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          consultation_id?: string
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultation_ratings_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          chat_session_id: string | null
          diagnosis: string | null
          doctor_id: string
          ended_at: string | null
          id: string
          notes: string | null
          patient_id: string
          started_at: string
          status: string
        }
        Insert: {
          chat_session_id?: string | null
          diagnosis?: string | null
          doctor_id: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          started_at?: string
          status?: string
        }
        Update: {
          chat_session_id?: string | null
          diagnosis?: string | null
          doctor_id?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_availability: {
        Row: {
          created_at: string
          description: string | null
          doctor_id: string
          duration_minutes: number
          id: string
          notifications_sent: boolean
          reminder_sent: boolean
          scheduled_at: string
          status: Database["public"]["Enums"]["availability_status"]
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          doctor_id: string
          duration_minutes?: number
          id?: string
          notifications_sent?: boolean
          reminder_sent?: boolean
          scheduled_at: string
          status?: Database["public"]["Enums"]["availability_status"]
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          doctor_id?: string
          duration_minutes?: number
          id?: string
          notifications_sent?: boolean
          reminder_sent?: boolean
          scheduled_at?: string
          status?: Database["public"]["Enums"]["availability_status"]
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      doctor_bank_accounts: {
        Row: {
          account_holder_name: string | null
          bank_name: string | null
          clabe_last4: string | null
          created_at: string
          doctor_id: string
          id: string
          is_verified: boolean | null
          onboarding_completed: boolean | null
          payouts_enabled: boolean | null
          stripe_account_id: string | null
          stripe_account_status: string | null
          updated_at: string
        }
        Insert: {
          account_holder_name?: string | null
          bank_name?: string | null
          clabe_last4?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          is_verified?: boolean | null
          onboarding_completed?: boolean | null
          payouts_enabled?: boolean | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          updated_at?: string
        }
        Update: {
          account_holder_name?: string | null
          bank_name?: string | null
          clabe_last4?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          is_verified?: boolean | null
          onboarding_completed?: boolean | null
          payouts_enabled?: boolean | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      doctor_content: {
        Row: {
          audience_type: Database["public"]["Enums"]["content_audience"]
          category: string | null
          created_at: string
          creator_id: string
          description: string | null
          file_url: string
          id: string
          is_public: boolean
          price: number | null
          thumbnail_url: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
        }
        Insert: {
          audience_type?: Database["public"]["Enums"]["content_audience"]
          category?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          file_url: string
          id?: string
          is_public?: boolean
          price?: number | null
          thumbnail_url?: string | null
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Update: {
          audience_type?: Database["public"]["Enums"]["content_audience"]
          category?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          file_url?: string
          id?: string
          is_public?: boolean
          price?: number | null
          thumbnail_url?: string | null
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
        }
        Relationships: []
      }
      doctor_invoices: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          doctor_id: string
          file_name: string
          file_url: string
          id: string
          invoice_number: string
          period_end: string
          period_start: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          doctor_id: string
          file_name: string
          file_url: string
          id?: string
          invoice_number: string
          period_end: string
          period_start: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          doctor_id?: string
          file_name?: string
          file_url?: string
          id?: string
          invoice_number?: string
          period_end?: string
          period_start?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      doctor_payouts: {
        Row: {
          amount: number
          created_at: string
          doctor_id: string
          error_message: string | null
          id: string
          invoice_id: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string | null
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          doctor_id: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          doctor_id?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_payouts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "doctor_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_profiles: {
        Row: {
          available_for_clinical_sessions: boolean
          available_for_double_check: boolean
          bio: string | null
          cedula_profesional: string | null
          cedula_verification_id: string | null
          consultation_fee: number
          created_at: string
          followers_count: number
          id: string
          license: string
          location: string | null
          numero_consejo: string | null
          payouts_enabled: boolean | null
          pending_earnings: number | null
          rating: number
          specialty: string
          status: Database["public"]["Enums"]["doctor_status"]
          stripe_account_id: string | null
          total_consultations: number
          total_earnings: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available_for_clinical_sessions?: boolean
          available_for_double_check?: boolean
          bio?: string | null
          cedula_profesional?: string | null
          cedula_verification_id?: string | null
          consultation_fee?: number
          created_at?: string
          followers_count?: number
          id?: string
          license: string
          location?: string | null
          numero_consejo?: string | null
          payouts_enabled?: boolean | null
          pending_earnings?: number | null
          rating?: number
          specialty: string
          status?: Database["public"]["Enums"]["doctor_status"]
          stripe_account_id?: string | null
          total_consultations?: number
          total_earnings?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available_for_clinical_sessions?: boolean
          available_for_double_check?: boolean
          bio?: string | null
          cedula_profesional?: string | null
          cedula_verification_id?: string | null
          consultation_fee?: number
          created_at?: string
          followers_count?: number
          id?: string
          license?: string
          location?: string | null
          numero_consejo?: string | null
          payouts_enabled?: boolean | null
          pending_earnings?: number | null
          rating?: number
          specialty?: string
          status?: Database["public"]["Enums"]["doctor_status"]
          stripe_account_id?: string | null
          total_consultations?: number
          total_earnings?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_profiles_cedula_verification_id_fkey"
            columns: ["cedula_verification_id"]
            isOneToOne: false
            referencedRelation: "cedula_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      email_history: {
        Row: {
          content_id: string | null
          content_title: string | null
          created_at: string
          doctor_id: string
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          status: string
          subject: string
        }
        Insert: {
          content_id?: string | null
          content_title?: string | null
          created_at?: string
          doctor_id: string
          email_type: string
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          status?: string
          subject: string
        }
        Update: {
          content_id?: string | null
          content_title?: string | null
          created_at?: string
          doctor_id?: string
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: []
      }
      identity_verifications: {
        Row: {
          created_at: string
          expires_at: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          provider: string
          status: Database["public"]["Enums"]["identity_verification_status"]
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          status?: Database["public"]["Enums"]["identity_verification_status"]
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          status?: Database["public"]["Enums"]["identity_verification_status"]
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      live_likes: {
        Row: {
          created_at: string
          id: string
          live_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          live_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_likes_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      lives: {
        Row: {
          description: string | null
          doctor_id: string
          ended_at: string | null
          id: string
          likes_count: number
          recording_price: number | null
          specialty: string
          started_at: string
          status: Database["public"]["Enums"]["live_status"]
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          viewer_count: number
        }
        Insert: {
          description?: string | null
          doctor_id: string
          ended_at?: string | null
          id?: string
          likes_count?: number
          recording_price?: number | null
          specialty: string
          started_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          viewer_count?: number
        }
        Update: {
          description?: string | null
          doctor_id?: string
          ended_at?: string | null
          id?: string
          likes_count?: number
          recording_price?: number | null
          specialty?: string
          started_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          viewer_count?: number
        }
        Relationships: []
      }
      medical_history: {
        Row: {
          category: string
          created_at: string
          date_of_study: string | null
          description: string | null
          file_size: number
          file_type: Database["public"]["Enums"]["vault_file_type"]
          file_url: string
          id: string
          patient_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          date_of_study?: string | null
          description?: string | null
          file_size?: number
          file_type: Database["public"]["Enums"]["vault_file_type"]
          file_url: string
          id?: string
          patient_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          date_of_study?: string | null
          description?: string | null
          file_size?: number
          file_type?: Database["public"]["Enums"]["vault_file_type"]
          file_url?: string
          id?: string
          patient_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean
          id: string
          in_app_notifications: boolean
          notify_chat_messages: boolean
          notify_doctor_live: boolean
          notify_new_content: boolean
          push_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          in_app_notifications?: boolean
          notify_chat_messages?: boolean
          notify_doctor_live?: boolean
          notify_new_content?: boolean
          push_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          in_app_notifications?: boolean
          notify_chat_messages?: boolean
          notify_doctor_live?: boolean
          notify_new_content?: boolean
          push_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          institution: string | null
          license: string | null
          selected_role: string | null
          specialty: string | null
          step: number
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          institution?: string | null
          license?: string | null
          selected_role?: string | null
          specialty?: string | null
          step?: number
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          institution?: string | null
          license?: string | null
          selected_role?: string | null
          specialty?: string | null
          step?: number
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      payout_settings: {
        Row: {
          auto_payout_enabled: boolean | null
          commission_percentage: number | null
          id: string
          minimum_payout_amount: number | null
          payout_day: number | null
          payout_frequency: string | null
          require_invoice: boolean | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_payout_enabled?: boolean | null
          commission_percentage?: number | null
          id?: string
          minimum_payout_amount?: number | null
          payout_day?: number | null
          payout_frequency?: string | null
          require_invoice?: boolean | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_payout_enabled?: boolean | null
          commission_percentage?: number | null
          id?: string
          minimum_payout_amount?: number | null
          payout_day?: number | null
          payout_frequency?: string | null
          require_invoice?: boolean | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          is_identity_verified: boolean
          name: string
          onboarding_completed: boolean
          preferred_language: Database["public"]["Enums"]["supported_language"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          is_identity_verified?: boolean
          name: string
          onboarding_completed?: boolean
          preferred_language?: Database["public"]["Enums"]["supported_language"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          is_identity_verified?: boolean
          name?: string
          onboarding_completed?: boolean
          preferred_language?: Database["public"]["Enums"]["supported_language"]
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          created_at: string
          id: string
          recording_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          recording_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          recording_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          created_at: string
          description: string | null
          doctor_id: string
          duration: number
          id: string
          live_id: string | null
          price: number
          specialty: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          doctor_id: string
          duration?: number
          id?: string
          live_id?: string | null
          price?: number
          specialty: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          doctor_id?: string
          duration?: number
          id?: string
          live_id?: string | null
          price?: number
          specialty?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recordings_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "lives"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          content_id: string
          content_type: string
          created_at: string
          description: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          content_id: string
          content_type: string
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      resident_group_activity: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_group_activity_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "resident_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "resident_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          image_url: string | null
          member_count: number
          name: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          image_url?: string | null
          member_count?: number
          name: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          image_url?: string | null
          member_count?: number
          name?: string
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      resident_profiles: {
        Row: {
          cedula_profesional: string | null
          created_at: string
          followers_count: number
          id: string
          institution: string
          specialty: string
          status: Database["public"]["Enums"]["doctor_status"]
          titulo_medicina: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          cedula_profesional?: string | null
          created_at?: string
          followers_count?: number
          id?: string
          institution: string
          specialty: string
          status?: Database["public"]["Enums"]["doctor_status"]
          titulo_medicina?: string | null
          updated_at?: string
          user_id: string
          year?: number
        }
        Update: {
          cedula_profesional?: string | null
          created_at?: string
          followers_count?: number
          id?: string
          institution?: string
          specialty?: string
          status?: Database["public"]["Enums"]["doctor_status"]
          titulo_medicina?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          creator_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          notify_on_availability: boolean
          notify_on_content: boolean
          notify_on_live: boolean
          price_paid: number
          subscriber_id: string
          tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Insert: {
          created_at?: string
          creator_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notify_on_availability?: boolean
          notify_on_content?: boolean
          notify_on_live?: boolean
          price_paid: number
          subscriber_id: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Update: {
          created_at?: string
          creator_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notify_on_availability?: boolean
          notify_on_content?: boolean
          notify_on_live?: boolean
          price_paid?: number
          subscriber_id?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
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
      vault_access: {
        Row: {
          consultation_id: string | null
          doctor_id: string
          expires_at: string | null
          file_id: string
          granted_at: string
          id: string
        }
        Insert: {
          consultation_id?: string | null
          doctor_id: string
          expires_at?: string | null
          file_id: string
          granted_at?: string
          id?: string
        }
        Update: {
          consultation_id?: string | null
          doctor_id?: string
          expires_at?: string | null
          file_id?: string
          granted_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_access_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "vault_files"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_files: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_size: number
          file_type: Database["public"]["Enums"]["vault_file_type"]
          file_url: string
          id: string
          medical_history_id: string | null
          name: string
          patient_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          file_size?: number
          file_type: Database["public"]["Enums"]["vault_file_type"]
          file_url: string
          id?: string
          medical_history_id?: string | null
          name: string
          patient_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_size?: number
          file_type?: Database["public"]["Enums"]["vault_file_type"]
          file_url?: string
          id?: string
          medical_history_id?: string | null
          name?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_files_medical_history_id_fkey"
            columns: ["medical_history_id"]
            isOneToOne: false
            referencedRelation: "medical_history"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          metadata: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      doctor_profiles_public: {
        Row: {
          available_for_clinical_sessions: boolean | null
          available_for_double_check: boolean | null
          bio: string | null
          created_at: string | null
          followers_count: number | null
          id: string | null
          location: string | null
          rating: number | null
          specialty: string | null
          status: Database["public"]["Enums"]["doctor_status"] | null
          total_consultations: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          available_for_clinical_sessions?: boolean | null
          available_for_double_check?: boolean | null
          bio?: string | null
          created_at?: string | null
          followers_count?: number | null
          id?: string | null
          location?: string | null
          rating?: number | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["doctor_status"] | null
          total_consultations?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          available_for_clinical_sessions?: boolean | null
          available_for_double_check?: boolean | null
          bio?: string | null
          created_at?: string | null
          followers_count?: number | null
          id?: string | null
          location?: string | null
          rating?: number | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["doctor_status"] | null
          total_consultations?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string | null
          is_identity_verified: boolean | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string | null
          is_identity_verified?: boolean | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string | null
          is_identity_verified?: boolean | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      resident_profiles_public: {
        Row: {
          created_at: string | null
          followers_count: number | null
          id: string | null
          institution: string | null
          specialty: string | null
          status: Database["public"]["Enums"]["doctor_status"] | null
          updated_at: string | null
          user_id: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          followers_count?: number | null
          id?: string | null
          institution?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["doctor_status"] | null
          updated_at?: string | null
          user_id?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          followers_count?: number | null
          id?: string | null
          institution?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["doctor_status"] | null
          updated_at?: string | null
          user_id?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_price_for_user: {
        Args: { _base_price: number; _user_id: string }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_doctor: { Args: { _user_id: string }; Returns: boolean }
      is_approved_resident: { Args: { _user_id: string }; Returns: boolean }
      notify_subscribers: {
        Args: {
          p_data?: Json
          p_doctor_id: string
          p_message: string
          p_notification_type: Database["public"]["Enums"]["notification_type"]
          p_title: string
        }
        Returns: number
      }
      process_wallet_purchase: {
        Args: { p_amount: number; p_description: string; p_metadata?: Json }
        Returns: Json
      }
      process_wallet_topup: { Args: { p_amount: number }; Returns: Json }
      user_has_vault_access: {
        Args: { p_file_id: string; p_user_id: string }
        Returns: boolean
      }
      user_is_clinical_session_participant: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      user_is_invitation_organizer: {
        Args: { p_invitation_session_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "visitor" | "patient" | "doctor" | "resident" | "admin"
      availability_status: "scheduled" | "confirmed" | "cancelled" | "completed"
      chat_participant_type: "patient" | "doctor" | "resident"
      chat_status: "active" | "closed"
      clinical_session_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "completed"
        | "cancelled"
      content_audience: "all" | "patients" | "professionals"
      content_type: "video" | "pdf" | "image"
      doctor_status: "pending" | "approved" | "rejected"
      identity_verification_status:
        | "pending"
        | "in_progress"
        | "verified"
        | "failed"
        | "expired"
      live_status: "live" | "ended" | "processing_recording" | "recording_ready"
      notification_type:
        | "doctor_live"
        | "doctor_availability"
        | "new_content"
        | "subscription_update"
        | "chat_message"
        | "system"
      subscription_tier: "free" | "basic" | "premium"
      supported_language: "es" | "en"
      transaction_status: "initiated" | "paid" | "failed"
      transaction_type:
        | "topup"
        | "purchase"
        | "refund"
        | "subscription"
        | "earning"
      vault_file_type: "pdf" | "image" | "study"
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
      app_role: ["visitor", "patient", "doctor", "resident", "admin"],
      availability_status: ["scheduled", "confirmed", "cancelled", "completed"],
      chat_participant_type: ["patient", "doctor", "resident"],
      chat_status: ["active", "closed"],
      clinical_session_status: [
        "pending",
        "accepted",
        "rejected",
        "completed",
        "cancelled",
      ],
      content_audience: ["all", "patients", "professionals"],
      content_type: ["video", "pdf", "image"],
      doctor_status: ["pending", "approved", "rejected"],
      identity_verification_status: [
        "pending",
        "in_progress",
        "verified",
        "failed",
        "expired",
      ],
      live_status: ["live", "ended", "processing_recording", "recording_ready"],
      notification_type: [
        "doctor_live",
        "doctor_availability",
        "new_content",
        "subscription_update",
        "chat_message",
        "system",
      ],
      subscription_tier: ["free", "basic", "premium"],
      supported_language: ["es", "en"],
      transaction_status: ["initiated", "paid", "failed"],
      transaction_type: [
        "topup",
        "purchase",
        "refund",
        "subscription",
        "earning",
      ],
      vault_file_type: ["pdf", "image", "study"],
    },
  },
} as const
