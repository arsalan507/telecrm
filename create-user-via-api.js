// Simple script to create test users via the registration API
async function createTestUsers() {
  const baseUrl = 'https://calltrackerpro-backend.vercel.app';
  
  const users = [
    {
      firstName: 'John',
      lastName: 'Agent',
      email: 'john.agent@blackarrow.com',
      password: 'Agent@123',
      organizationName: 'Blackarrowtechnologies',
      role: 'agent',
      phone: '9876543211'
    },
    {
      firstName: 'Sarah', 
      lastName: 'Manager',
      email: 'sarah.manager@blackarrow.com',
      password: 'Manager@123',
      organizationName: 'Blackarrowtechnologies', 
      role: 'manager',
      phone: '9876543210'
    },
    {
      firstName: 'Emma',
      lastName: 'Viewer', 
      email: 'emma.viewer@blackarrow.com',
      password: 'Viewer@123',
      organizationName: 'Blackarrowtechnologies',
      role: 'viewer', 
      phone: '9876543212'
    }
  ];

  console.log('Creating test users...');

  for (const user of users) {
    try {
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(user)
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Created user: ${user.email} (${user.role})`);
      } else {
        console.log(`❌ Failed to create ${user.email}: ${result.message}`);
      }
    } catch (error) {
      console.log(`❌ Error creating ${user.email}:`, error.message);
    }
  }
}

createTestUsers().catch(console.error);