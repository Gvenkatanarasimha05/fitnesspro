const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: { type: String, default: "" }, // Add bio field
    profilePic: { type: String, default: "/images/default-avatar.png" } // Add profilePic field
});

const User = mongoose.model('User', userSchema);

module.exports = User;
