-- migrations/001_create_tables.sql
-- CallTracker Pro Database Schema for PostgreSQL/Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id UUID,
    owner_email VARCHAR(255),
    domain VARCHAR(100),
    industry VARCHAR(50),
    website VARCHAR(255),
    phone VARCHAR(20),
    address JSONB,
    
    -- Subscription & Billing
    subscription_plan VARCHAR(20) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'business', 'enterprise')),
    subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled')),
    user_limit INTEGER DEFAULT 5,
    call_limit INTEGER DEFAULT 50,
    contact_limit INTEGER DEFAULT 100,
    team_limit INTEGER DEFAULT 1,
    
    -- Settings & Configuration
    settings JSONB DEFAULT '{}',
    branding JSONB DEFAULT '{}',
    billing JSONB DEFAULT '{}',
    features JSONB DEFAULT '{}',
    
    -- Status & Metadata
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(name),
    UNIQUE(domain)
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar VARCHAR(255),
    
    -- Organization & Role
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    organization_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'org_admin' CHECK (role IN ('super_admin', 'org_admin', 'manager', 'agent', 'viewer')),
    permissions TEXT[] DEFAULT '{}',
    
    -- Team Information
    team_id UUID,
    manager_id UUID REFERENCES users(id),
    team_permissions JSONB[] DEFAULT '{}',
    
    -- Login Tracking (NEW FEATURE)
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_history JSONB[] DEFAULT '{}',
    
    -- Account Status
    is_active BOOLEAN DEFAULT true,
    is_email_verified BOOLEAN DEFAULT false,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Subscription & Limits
    subscription_plan VARCHAR(20) DEFAULT 'free',
    call_limit INTEGER DEFAULT 50,
    calls_used INTEGER DEFAULT 0,
    
    -- Performance Metrics
    ticket_stats JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    performance_targets JSONB DEFAULT '{}',
    
    -- Security
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    signup_source VARCHAR(20) DEFAULT 'web' CHECK (signup_source IN ('web', 'android', 'ios', 'api')),
    signup_step VARCHAR(50) DEFAULT 'completed',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Basic Information
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES users(id),
    
    -- Configuration
    settings JSONB DEFAULT '{}',
    targets JSONB DEFAULT '{}',
    
    -- Statistics
    stats JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(organization_id, name)
);

-- Contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Basic Information
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(255),
    phone VARCHAR(20),
    company VARCHAR(100),
    job_title VARCHAR(100),
    
    -- Contact Details
    address JSONB,
    social_media JSONB DEFAULT '{}',
    
    -- Lead Information
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
    lead_source VARCHAR(50),
    deal_value DECIMAL(12,2) DEFAULT 0,
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Call Logs table
CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Call Information
    user_id UUID NOT NULL REFERENCES users(id),
    contact_id UUID REFERENCES contacts(id),
    phone_number VARCHAR(20),
    
    -- Call Details
    type VARCHAR(20) DEFAULT 'outbound' CHECK (type IN ('inbound', 'outbound')),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'missed', 'voicemail', 'busy', 'failed')),
    duration INTEGER DEFAULT 0, -- in seconds
    
    -- Call Content
    summary TEXT,
    notes TEXT,
    recording_url VARCHAR(255),
    
    -- Follow-up
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ticket_id VARCHAR(50) UNIQUE,
    
    -- Basic Information
    title VARCHAR(200) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_customer', 'resolved', 'closed')),
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    
    -- Customer Information
    customer_id UUID REFERENCES contacts(id),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    
    -- Timing
    due_date TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance Metrics
    actual_resolution_time INTEGER, -- in hours
    customer_satisfaction JSONB,
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Notification Details
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Related Entity
    entity_type VARCHAR(50), -- 'ticket', 'call', 'contact', etc.
    entity_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_login_count ON users(login_count);
CREATE INDEX idx_users_last_login_at ON users(last_login_at);

CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_teams_manager_id ON teams(manager_id);

CREATE INDEX idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);

CREATE INDEX idx_call_logs_organization_id ON call_logs(organization_id);
CREATE INDEX idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX idx_call_logs_contact_id ON call_logs(contact_id);
CREATE INDEX idx_call_logs_created_at ON call_logs(created_at);

CREATE INDEX idx_tickets_organization_id ON tickets(organization_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_ticket_id ON tickets(ticket_id);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_logs_updated_at BEFORE UPDATE ON call_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies (Optional - for multi-tenant security)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Insert default super admin user (to be updated with real data)
-- This will be replaced during data migration