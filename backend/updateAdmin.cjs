const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const updateAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const args = process.argv.slice(2);
        if (args.length < 2) {
            console.log('Usage: node updateAdmin.cjs <new_username> <new_password>');
            process.exit(1);
        }

        const newUsername = args[0];
        const newPassword = args[1];

        const passwordHash = await bcrypt.hash(newPassword, 10);

        const result = await mongoose.connection.db.collection('users').updateOne(
            { role: 'ADMIN' },
            {
                $set: {
                    username: newUsername,
                    passwordHash: passwordHash
                }
            }
        );

        if (result.matchedCount === 0) {
            console.log('❌ No Admin user found!');
            // Optional: Create one if not found
        } else {
            console.log(`✅ Admin updated successfully!`);
            console.log(`   Username: ${newUsername}`);
            console.log(`   Password: ${newPassword}`);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Error:', err);
    }
};

updateAdmin();
