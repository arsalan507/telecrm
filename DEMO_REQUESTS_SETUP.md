# Demo Requests Setup Guide

## 🚀 Database Setup Required

Before using the demo requests endpoint, you need to run the database migration:

### Step 1: Run Database Migration

Execute the following SQL in your Supabase SQL editor:

```sql
-- Copy and paste the entire contents of migrations/002_demo_requests.sql
-- This will create the demo_requests table with all required fields
```

### Step 2: Configure Email Service (Optional)

Set these environment variables for email functionality:

```env
# Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=demos@calltrackerpro.com
SALES_ALERT_EMAIL=sales@calltrackerpro.com
```

### Step 3: Test the Endpoint

```bash
curl -X POST https://calltrackerpro-backend.vercel.app/api/demo-requests \
  -H "Content-Type: application/json" \
  -d '{
    "triggerEvent": "roi-questioned",
    "costOfInaction": "client-relationships", 
    "currentTrackingMethod": ["ask-customers", "manual-logging"],
    "magicWandInsight": "I wish I could see which ads drive phone calls",
    "mustHaveIntegrations": ["Google Ads", "Salesforce"],
    "victoryPriorities": ["prove-roi", "eliminate-waste"],
    "decisionStyle": 25,
    "stakeholders": ["My boss/executive team"],
    "personalWin": "prove-strategic",
    "name": "John Marketing",
    "email": "john.test@example.com", 
    "bestDemoTime": "Mid-week afternoons",
    "preferredDemoLength": "Thorough 30-minute deep dive"
  }'
```

## 📊 Available Endpoints

### POST /api/demo-requests
- Accepts psychological profiling data
- Returns lead score and intent level
- Sends personalized confirmation emails
- Triggers sales alerts for high-intent leads

### GET /api/demo-requests
- Lists all demo requests with filtering
- Supports pagination and search
- Requires authentication (add auth middleware)

### GET /api/demo-requests/analytics  
- Provides lead analytics and insights
- Shows conversion rates and top triggers
- Intent level distribution

## 🧠 Lead Scoring Algorithm

**Trigger Event Urgency (0-40 points):**
- roi-questioned: 40 points
- lost-deal: 35 points  
- competitor-stealing: 30 points
- wasted-ads: 25 points
- lead-quality: 20 points
- scaling-chaos: 15 points
- exploring: 5 points

**Cost of Inaction Weight (0-30 points):**
- client-relationships: 30 points
- missed-revenue: 25 points
- reputation: 20 points
- competitive-advantage: 15 points
- wasted-spend: 10 points
- hard-to-quantify: 5 points

**Additional Factors:**
- Tracking method complexity: 5-15 points
- Victory priorities clarity: 3-10 points  
- Decision style confidence: 0-5 points

**Intent Levels:**
- Urgent: 80+ points or urgent triggers + costs
- High: 60+ points or complex stakeholders
- Medium: 40+ points
- Low: <40 points

## 🎯 Sales Intelligence Features

- **Psychological Profiling**: Understand motivations and decision style
- **Urgency Scoring**: Prioritize leads by urgency (0-100)
- **Stakeholder Analysis**: Identify decision-making complexity
- **Personalization**: Customize demos based on priorities
- **Risk Assessment**: Understand cost of inaction

The system provides rich behavioral insights for sales teams to tailor their approach and improve conversion rates.