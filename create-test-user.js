// Quick script to create a single test user on production
const bcrypt = require('bcryptjs');

async function createTestUser() {
  const userData = {
    first_name: 'John',
    last_name: 'Agent',
    email: 'john.agent@blackarrow.com',
    password: 'Agent@123'
  };

  // Hash password
  const password_hash = await bcrypt.hash(userData.password, 12);
  
  const response = await fetch('https://calltrackerpro-backend.vercel.app/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      firstName: userData.first_name,
      lastName: userData.last_name,
      email: userData.email,
      password: userData.password,
      organizationName: 'Blackarrowtechnologies',
      role: 'agent',
      phone: '9876543211'
    })
  });

  const result = await response.json();
  console.log('User creation result:', result);
}

createTestUser().catch(console.error);