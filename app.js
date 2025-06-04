const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer'); 
const fs = require('fs');
const User = require('./models/users'); 
const Post = require('./models/posts');
const MongoStore = require('connect-mongo');

const app = express();

mongoose.connect('mongodb://localhost:27017/fitnesspro', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Connection Error:", err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(session({
    secret: 'venkat2005',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/yourDB' })
}));

app.use((req, res, next) => {
    console.log('Session Data:', req.session);
    next();
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './public/uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, req.session.user._id + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }

    const workoutVerified = Math.random() > 0.5;
    const feedback = workoutVerified ? "Great form! Keep it up." : "Try improving your posture.";

    res.json({ verified: workoutVerified, feedback });
});

app.get('/workout', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }
    res.render('workout');
});

const features = [
    { icon: 'fas fa-running', title: 'Smart Tracking', description: 'Track your workouts with AI-powered insights that adapt to your progress.' },
    { icon: 'fas fa-users', title: 'Community', description: 'Join a community of fitness enthusiasts to stay motivated and connected.' },
    { icon: 'fas fa-chart-line', title: 'Performance Insights', description: 'Get detailed analysis and feedback to optimize your performance and growth.' }
];

const testimonials = [
    { name: 'Venkat', role: 'Fitness Enthusiast', feedback: '"FitnessPro changed my workout routine. The tracking is spot on!"' },
    { name: 'Narasimha', role: 'Personal Trainer', feedback: '"The community keeps me motivated every day. Love the insights!"' }
];

app.get('/', (req, res) => {
    res.render('index', { features, testimonials });
});

app.get('/auth', (req, res) => {
    res.render('auth');
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, profilePic: "/images/default-avatar.png" });
        await newUser.save();
        req.session.user = newUser;
        res.redirect('/dashboard');
    } catch (error) {
        res.redirect('/auth?error=Registration failed');
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = { _id: user._id, name: user.name };
        res.redirect('/dashboard');
    } else {
        res.redirect('/auth?error=Invalid credentials');
    }
});

app.get('/dashboard', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }

    try {
        const user = await User.findById(req.session.user._id).lean();
        if (!user) {
            return res.redirect('/auth');
        }

        const posts = [
            { title: "Morning Workout", content: "Completed a 5K run today!", author: "John", date: "2025-02-20" },
            { title: "Healthy Eating", content: "Tried a new protein smoothie. Highly recommended!", author: "Alice", date: "2025-02-19" }
        ];

        res.render('dashboard', { user, posts });
    } catch (error) {
        console.error("Dashboard Error:", error);
        res.redirect('/auth');
    }
});

app.get('/community', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }

    try {
        const userPosts = await Post.find({ postType: 'user' }).sort({ createdAt: -1 }).lean();
        const influencerPosts = await Post.find({ postType: 'influencer' }).sort({ createdAt: -1 }).lean();

        res.render('community', { user: req.session.user, userPosts, influencerPosts });
    } catch (error) {
        console.error("Community Error:", error);
        res.redirect('/dashboard');
    }
});

app.post('/community', async (req, res) => {
    console.log("Session Data:", req.session);

    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Unauthorized - No session user" });
    }

    try {
        const { content } = req.body;
        const newPost = new Post({
            user: req.session.user._id,
            username: req.session.user.name,
            content
        });

        await newPost.save();
        res.redirect('/community');
    } catch (error) {
        console.error("Error creating post:", error);
        res.redirect('/community');
    }
});

app.get('/profile', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }

    try {
        const user = await User.findById(req.session.user._id).lean();
        if (!user) {
            return res.redirect('/dashboard');
        }

        res.render('profile', { user });
    } catch (error) {
        console.log("Profile Error:", error);
        res.redirect('/dashboard');
    }
});

app.get('/edit', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }

    try {
        const user = await User.findById(req.session.user._id).lean();
        res.render('edit', { user });
    } catch (error) {
        console.error("Error fetching user:", error);
        res.redirect('/profile');
    }
});

app.post('/edit', upload.single('profilePic'), async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    try {
        const { name, bio } = req.body;
        let updateData = { name, bio };

        if (req.file) {
            updateData.profilePic = `/uploads/${req.file.filename}`;
        }

        const updatedUser = await User.findByIdAndUpdate(req.session.user._id, updateData, { new: true });

        req.session.user = updatedUser;

        res.json({ success: true, message: "Profile updated successfully", user: updatedUser });

    } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({ success: false, message: "Error updating profile" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
