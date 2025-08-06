-- migrations/002_demo_requests.sql
-- Demo Requests with Psychological Profiling for CallTracker Pro

-- Demo Requests table
CREATE TABLE demo_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Contact Information
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    
    -- Step 1: The Moment of Truth
    trigger_event VARCHAR(50) NOT NULL CHECK (trigger_event IN (
        'roi-questioned', 'lost-deal', 'wasted-ads', 'lead-quality', 
        'competitor-stealing', 'scaling-chaos', 'exploring'
    )),
    cost_of_inaction VARCHAR(50) NOT NULL CHECK (cost_of_inaction IN (
        'client-relationships', 'wasted-spend', 'missed-revenue', 
        'reputation', 'competitive-advantage', 'hard-to-quantify'
    )),
    
    -- Step 2: The Attribution Detective
    current_tracking_method TEXT[] DEFAULT '{}', -- Array of tracking methods
    magic_wand_insight TEXT,
    must_have_integrations TEXT[] DEFAULT '{}', -- Array of required integrations
    
    -- Step 3: The Success Scenario
    victory_priorities TEXT[] DEFAULT '{}', -- Array of priorities
    decision_style INTEGER CHECK (decision_style >= 0 AND decision_style <= 100),
    
    -- Step 4: The Connection
    stakeholders TEXT[] DEFAULT '{}', -- Array of stakeholders
    personal_win VARCHAR(50) CHECK (personal_win IN (
        'prove-strategic', 'confidence', 'recognition', 
        'push-back', 'hero', 'sleep-better'
    )),
    best_demo_time VARCHAR(100),
    preferred_demo_length VARCHAR(100),
    
    -- Lead Intelligence
    urgency_score INTEGER DEFAULT 0, -- Calculated urgency score 0-100
    intent_level VARCHAR(20) DEFAULT 'medium' CHECK (intent_level IN ('low', 'medium', 'high', 'urgent')),
    lead_source VARCHAR(50) DEFAULT 'demo-form',
    
    -- Status & Processing
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo-scheduled', 'demo-completed', 'converted', 'lost')),
    assigned_to UUID, -- Sales rep assignment
    demo_scheduled_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    referrer_url TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for common queries
    CONSTRAINT demo_requests_email_unique UNIQUE(email)
);

-- Indexes for performance
CREATE INDEX idx_demo_requests_status ON demo_requests(status);
CREATE INDEX idx_demo_requests_intent_level ON demo_requests(intent_level);
CREATE INDEX idx_demo_requests_trigger_event ON demo_requests(trigger_event);
CREATE INDEX idx_demo_requests_created_at ON demo_requests(created_at DESC);
CREATE INDEX idx_demo_requests_urgency_score ON demo_requests(urgency_score DESC);

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

-- Comments for documentation
COMMENT ON TABLE demo_requests IS 'Psychologically-profiled demo requests with behavioral insights for sales intelligence';
COMMENT ON COLUMN demo_requests.trigger_event IS 'What triggered them to seek a solution';
COMMENT ON COLUMN demo_requests.cost_of_inaction IS 'What they risk by not solving this problem';
COMMENT ON COLUMN demo_requests.decision_style IS 'Slider 0-100: 0=data-driven, 100=story-driven';
COMMENT ON COLUMN demo_requests.urgency_score IS 'Calculated urgency score based on psychological profiling';
COMMENT ON COLUMN demo_requests.intent_level IS 'Categorized buying intent: low/medium/high/urgent';