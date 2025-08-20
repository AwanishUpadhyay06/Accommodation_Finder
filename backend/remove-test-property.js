const mongoose = require('mongoose');
require('dotenv').config();

// Import the Property model
const Property = require('./models/Property');

async function removeTestProperties() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all properties
    const properties = await Property.find({});
    console.log('\nCurrent properties in database:');
    properties.forEach((property, index) => {
      console.log(`${index + 1}. ${property.title} (ID: ${property._id})`);
      console.log(`   Location: ${property.location.city}, ${property.location.address}`);
      console.log(`   Price: $${property.price}`);
      console.log('');
    });

    // Look for test properties (you can modify this criteria)
    const testProperties = await Property.find({
      $or: [
        { title: { $regex: /test/i } },
        { description: { $regex: /test/i } },
        { 'location.address': { $regex: /test/i } },
        { 'location.city': { $regex: /test/i } }
      ]
    });

    if (testProperties.length > 0) {
      console.log(`Found ${testProperties.length} test property(ies):`);
      testProperties.forEach((property, index) => {
        console.log(`${index + 1}. ${property.title} (ID: ${property._id})`);
      });

      // Remove test properties
      const result = await Property.deleteMany({
        $or: [
          { title: { $regex: /test/i } },
          { description: { $regex: /test/i } },
          { 'location.address': { $regex: /test/i } },
          { 'location.city': { $regex: /test/i } }
        ]
      });

      console.log(`\n✅ Removed ${result.deletedCount} test property(ies) from the database.`);
    } else {
      console.log('No test properties found in the database.');
    }

    // Show remaining properties
    const remainingProperties = await Property.find({});
    console.log(`\nRemaining properties: ${remainingProperties.length}`);
    remainingProperties.forEach((property, index) => {
      console.log(`${index + 1}. ${property.title}`);
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
removeTestProperties();
