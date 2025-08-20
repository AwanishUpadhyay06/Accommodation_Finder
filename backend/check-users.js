const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('./models/User');

async function checkUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find({});
    console.log('\nUsers in database:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   ID: ${user._id}`);
      console.log('');
    });

    // Find owners specifically
    const owners = await User.find({ role: 'owner' });
    console.log(`Found ${owners.length} owner(s):`);
    owners.forEach((owner, index) => {
      console.log(`${index + 1}. ${owner.name} (${owner.email})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the script
checkUsers();
