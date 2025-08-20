const mongoose = require('mongoose');
require('dotenv').config();

const Property = require('../models/Property');
const User = require('../models/User');

const checkPropertyCounts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all owners
    const owners = await User.find({ role: 'owner' });
    
    for (const owner of owners) {
      console.log(`\n--- Owner: ${owner.name} (${owner.email}) ---`);
      
      // Count all properties
      const allProperties = await Property.countDocuments({ owner: owner._id });
      console.log(`Total properties: ${allProperties}`);
      
      // Count active properties
      const activeProperties = await Property.countDocuments({ 
        owner: owner._id, 
        isActive: true 
      });
      console.log(`Active properties: ${activeProperties}`);
      
      // Count visible properties
      const visibleProperties = await Property.countDocuments({ 
        owner: owner._id, 
        isVisible: true 
      });
      console.log(`Visible properties: ${visibleProperties}`);
      
      // Count active AND visible properties (what analytics should show)
      const analyticsProperties = await Property.countDocuments({ 
        owner: owner._id, 
        isActive: true,
        isVisible: true
      });
      console.log(`Analytics properties (active + visible): ${analyticsProperties}`);
      
      // Show inactive properties
      const inactiveProperties = await Property.find({ 
        owner: owner._id, 
        isActive: false 
      }).select('title isActive isVisible');
      
      if (inactiveProperties.length > 0) {
        console.log('Inactive properties:');
        inactiveProperties.forEach(prop => {
          console.log(`  - ${prop.title} (active: ${prop.isActive}, visible: ${prop.isVisible})`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error checking property counts:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

checkPropertyCounts();
