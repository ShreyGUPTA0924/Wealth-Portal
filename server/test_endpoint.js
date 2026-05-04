const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

async function test() {
  try {
    const user = await prisma.user.findFirst();
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'supersecretjwtkey', { expiresIn: '1d' });
    
    const res = await axios.post('http://localhost:5000/api/ai/analyse', {}, {
      headers: {
        Cookie: `accessToken=${token}`
      }
    });
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
