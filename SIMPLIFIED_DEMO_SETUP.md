# Simplified Demo Requests Setup Guide

## 🚀 Quick Setup

### Step 1: Run Database Migration

Execute this SQL in your Supabase SQL editor:

```sql
-- Copy and paste the entire contents of migrations/003_simplified_demo_requests.sql
-- This creates the new simplified demo_requests table
```

### Step 2: Test the Endpoint

```bash
curl -X POST https://calltrackerpro-backend.vercel.app/api/demo-requests \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "email": "john.smith@example.com",
    "company": "Test Corp",
    "phone": "+1234567890",
    "urgency": "urgent",
    "currentPain": "wasted-ad-spend",
    "budget": "5k-10k",
    "timeline": "this-week",
    "message": "We need better call tracking ASAP!"
  }'
```

## 📋 New Form Structure

### Required Fields
```json
{
  "name": "string (required)",
  "email": "string (required)", 
  "urgency": "urgent|planned|exploring (required)"
}
```

### Optional Fields
```json
{
  "company": "string",
  "phone": "string",
  "currentPain": "wasted-ad-spend|poor-roi-tracking|missed-opportunities|manual-tracking|competitor-advantage|other",
  "budget": "under-1k|1k-5k|5k-10k|10k-plus|not-sure",
  "timeline": "this-week|this-month|next-month|next-quarter|flexible",
  "message": "string"
}
```

## 🎯 Lead Scoring Algorithm

**Base Score: 50 points**

### Urgency Points (Primary Factor)
- urgent: +30 points
- planned: +15 points  
- exploring: +0 points

### Timeline Boost
- this-week: +20 points
- this-month: +10 points
- next-month: +5 points
- next-quarter: +0 points
- flexible: -5 points

### Budget Indicator
- 10k-plus: +15 points
- 5k-10k: +10 points
- 1k-5k: +5 points
- under-1k: +0 points
- not-sure: -5 points

### Pain Point Urgency
- missed-opportunities: +12 points
- wasted-ad-spend: +10 points
- competitor-advantage: +10 points
- poor-roi-tracking: +8 points
- manual-tracking: +5 points
- other: +3 points

### Bonus Points
- Company provided: +5 points
- Phone provided: +5 points

## 🚨 Auto-Priority Assignment

### High Priority
- urgency = "urgent"
- timeline = "this-week" or "this-month" (boosts medium to high)

### Medium Priority  
- urgency = "planned"
- timeline boost from low

### Low Priority
- urgency = "exploring"

## ⚡ Auto-Follow-up Actions

### Urgent Leads (2 hours)
- Send immediate sales alert
- Call within 2 hours  
- Priority demo scheduling

### Planned Leads (24 hours)
- Add to CRM with high priority
- Email within 4 hours
- Call within 24 hours

### Exploring Leads (72 hours)
- Add to nurture campaign
- Send resource email
- Follow up in 3 days

## 📊 Available Endpoints

### POST /api/demo-requests
Submit new demo request with automatic scoring and priority assignment.

### GET /api/demo-requests
List requests with filtering:
- `urgency=urgent|planned|exploring`
- `priority=high|medium|low`
- `timeline=this-week|this-month|etc`
- `status=new|contacted|demo-scheduled|etc`
- `search=name|email|company`

### GET /api/demo-requests/analytics
Analytics dashboard with:
- Urgency breakdown
- Priority distribution  
- Top pain points
- Budget segments
- Conversion rates
- Average lead scores

### GET /api/demo-requests/health
System health check and setup verification.

## 🔧 Database Features

### Auto-Triggers
- **Follow-up dates**: Automatically set based on urgency
- **Priority calculation**: Based on urgency + timeline
- **Segment assignment**: Based on budget ranges

### Smart Indexes
- Optimized for urgency, priority, timeline queries
- Lead score sorting for sales dashboards
- Email uniqueness for duplicate prevention

## 📧 Email Notifications

High-priority leads automatically trigger sales alerts with:
- Complete contact information
- Sales qualification summary  
- Recommended follow-up actions
- Lead score and segment analysis

## ✅ Benefits

- **Faster form completion**: 60% fewer fields
- **Better lead qualification**: Urgency-first approach  
- **Clearer sales actions**: Priority-driven follow-ups
- **Higher reliability**: Simplified data structure
- **Improved conversion**: Streamlined user experience

The new system focuses on the essentials: urgency, pain points, and contact information, while still providing rich sales intelligence through automated scoring and prioritization.