-- migrations/003_simplified_demo_requests.sql
-- Simplified Demo Requests Table for CallTracker Pro

-- Drop existing demo_requests table if it exists (for clean migration)
DROP TABLE IF EXISTS demo_requests;

-- Create simplified demo_requests table
CREATE TABLE demo_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contact Information (Required)
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    
    -- Contact Information (Optional)
    company VARCHAR(200),
    phone VARCHAR(20),
    
    -- Sales Qualification (Required)
    urgency VARCHAR(20) NOT NULL CHECK (urgency IN ('urgent', 'planned', 'exploring')),
    
    -- Sales Qualification (Optional)
    current_pain VARCHAR(50) CHECK (current_pain IN (
        'wasted-ad-spend', 'poor-roi-tracking', 'missed-opportunities', 
        'manual-tracking', 'competitor-advantage', 'other'
    )),
    budget VARCHAR(20) CHECK (budget IN (
        'under-1k', '1k-5k', '5k-10k', '10k-plus', 'not-sure'
    )),
    timeline VARCHAR(20) CHECK (timeline IN (
        'this-week', 'this-month', 'next-month', 'next-quarter', 'flexible'
    )),
    message TEXT,
    
    -- Auto-calculated Lead Intelligence
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    segment VARCHAR(20) DEFAULT 'small-business' CHECK (segment IN (
        'small-business', 'mid-market', 'enterprise'
    )),
    lead_score INTEGER DEFAULT 50, -- 0-100 scoring
    
    -- Status & Processing
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN (
        'new', 'contacted', 'demo-scheduled', 'demo-completed', 'converted', 'lost'
    )),
    assigned_to UUID, -- Sales rep assignment
    demo_scheduled_at TIMESTAMP WITH TIME ZONE,
    follow_up_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    referrer_url TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    lead_source VARCHAR(50) DEFAULT 'demo-form',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_demo_requests_urgency ON demo_requests(urgency);
CREATE INDEX idx_demo_requests_priority ON demo_requests(priority);
CREATE INDEX idx_demo_requests_status ON demo_requests(status);
CREATE INDEX idx_demo_requests_timeline ON demo_requests(timeline);
CREATE INDEX idx_demo_requests_budget ON demo_requests(budget);
CREATE INDEX idx_demo_requests_created_at ON demo_requests(created_at DESC);
CREATE INDEX idx_demo_requests_lead_score ON demo_requests(lead_score DESC);
CREATE INDEX idx_demo_requests_email ON demo_requests(email);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_demo_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER demo_requests_updated_at
    BEFORE UPDATE ON demo_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_demo_requests_timestamp();

-- Auto-assign follow-up dates based on urgency
CREATE OR REPLACE FUNCTION set_follow_up_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Set follow-up date based on urgency
    CASE NEW.urgency
        WHEN 'urgent' THEN
            NEW.follow_up_date = NOW() + INTERVAL '2 hours';
            NEW.priority = 'high';
        WHEN 'planned' THEN
            NEW.follow_up_date = NOW() + INTERVAL '1 day';
            NEW.priority = 'medium';
        WHEN 'exploring' THEN
            NEW.follow_up_date = NOW() + INTERVAL '3 days';
            NEW.priority = 'low';
    END CASE;
    
    -- Boost priority based on timeline
    IF NEW.timeline IN ('this-week', 'this-month') THEN
        NEW.priority = CASE 
            WHEN NEW.priority = 'low' THEN 'medium'
            WHEN NEW.priority = 'medium' THEN 'high'
            ELSE NEW.priority
        END;
    END IF;
    
    -- Set segment based on budget
    NEW.segment = CASE NEW.budget
        WHEN '10k-plus' THEN 'enterprise'
        WHEN '5k-10k' THEN 'enterprise'
        WHEN '1k-5k' THEN 'mid-market'
        ELSE 'small-business'
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_demo_request_follow_up
    BEFORE INSERT ON demo_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_follow_up_date();

-- Comments for documentation
COMMENT ON TABLE demo_requests IS 'Simplified demo requests with urgency-based lead scoring';
COMMENT ON COLUMN demo_requests.urgency IS 'Primary lead qualifier: urgent/planned/exploring';
COMMENT ON COLUMN demo_requests.current_pain IS 'Specific pain point for demo customization';
COMMENT ON COLUMN demo_requests.priority IS 'Auto-calculated priority: low/medium/high';
COMMENT ON COLUMN demo_requests.segment IS 'Auto-calculated segment based on budget';
COMMENT ON COLUMN demo_requests.follow_up_date IS 'Auto-calculated follow-up date based on urgency';
COMMENT ON COLUMN demo_requests.lead_score IS 'Calculated lead score 0-100';