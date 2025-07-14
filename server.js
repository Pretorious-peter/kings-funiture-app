const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const captionsPath = path.join(__dirname, 'captions.json');

if (!fs.existsSync(captionsPath)) {
    fs.writeFileSync(captionsPath, '{}');
}

let captions = JSON.parse(fs.readFileSync(captionsPath));

app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const original = file.originalname.toLowerCase().replace(/\s+/g, '-');
        const ext = path.extname(original);
        const name = path.basename(original, ext).replace(/[^a-z0-9\-]/g, '');
        cb(null, `${timestamp}-${name}${ext}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

// GET /images – Sorted by modified time, filters only valid image files
app.get('/images', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Could not read uploads folder' });

        const imageList = files
            .filter(name => /\.(jpe?g|png|webp|gif)$/i.test(name))
            .map(name => ({
                name,
                time: fs.statSync(path.join(uploadDir, name)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time)
            .map(({ name }) => ({
                name,
                caption: captions[name] || ''
            }));

        res.json(imageList);
    });
});
// POST /upload – Save new image
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).send('No image uploaded.');

    const caption = req.body.caption?.trim() || '';
    const filename = req.file.filename;
   
    captions[filename] = caption;
    fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2));
    //console.log('Received caption:', req.body.caption);
    // console.log('File name:', req.file?.filename); 


    res.send('Upload successful!');
});
// DELETE /images/:name – Remove image by filename (safe decoding)
app.delete('/images/:name', (req, res) => {
    const filename = decodeURIComponent(req.params.name);
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found.');
    }

    fs.unlink(filePath, (err) => {
        if (err) return res.status(500).send('Failed to delete image.');
        res.status(200).send('Image deleted successfully.');
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});