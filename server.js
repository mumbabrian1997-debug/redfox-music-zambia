const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');
const SONGS_FILE = path.join(DATA_DIR, 'songs.json');
const DOWNLOADS_FILE = path.join(DATA_DIR, 'downloads.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

ensureDirectories();
ensureDataFiles();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'redfoxadmin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'redfoxmusic';
const SESSION_SECRET = process.env.SESSION_SECRET || 'redfox-music-zambia-secret';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(ROOT_DIR, 'public')));

const uploadMedia = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, file.fieldname === 'audioFile' ? AUDIO_DIR : COVERS_DIR);
    },
    filename: (req, file, cb) => {
      const safeName = sanitizeFileName(path.basename(file.originalname, path.extname(file.originalname)));
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${safeName}${ext}`);
    },
  }),
  limits: {
    fileSize: 250 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedAudioExt = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.mp4'];
    const allowedImageExt = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === 'audioFile') {
      if (!allowedAudioExt.includes(ext)) {
        return cb(new Error('Only MP3, WAV, FLAC, AAC, M4A, OGG, and MP4 audio files are allowed.'));
      }
    }

    if (file.fieldname === 'coverArt') {
      if (!allowedImageExt.includes(ext)) {
        return cb(new Error('Only JPG, PNG, and WEBP cover image files are allowed.'));
      }
    }

    cb(null, true);
  },
});

function ensureDirectories() {
  [DATA_DIR, UPLOADS_DIR, AUDIO_DIR, COVERS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function ensureDataFiles() {
  if (!fs.existsSync(SONGS_FILE)) {
    fs.writeFileSync(SONGS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(DOWNLOADS_FILE)) {
    fs.writeFileSync(DOWNLOADS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(
        {
          storageCapacityGb: 50,
          bandwidthGbMonthly: 250,
          costEstimate: 'Typical shared-hosting plans range from $5-$20/month for a 50GB storage and 250GB monthly transfer budget; larger libraries or more downloads increase the plan size.',
          notes: 'Use local or cloud object storage with a monthly transfer cap and keep an eye on audio file sizes and bandwidth consumption.',
        },
        null,
        2
      )
    );
  }
}

function readJSON(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sanitizeFileName(value) {
  return String(value || 'track')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'track';
}

function slugify(value) {
  return sanitizeFileName(value).replace(/-/g, ' ');
}

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return false;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function getSongById(id) {
  const songs = readJSON(SONGS_FILE, []);
  return songs.find((song) => song.id === id) || null;
}

function getAllSongs() {
  return readJSON(SONGS_FILE, []).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
}

function saveSongs(songs) {
  writeJSON(SONGS_FILE, songs);
}

function getSettings() {
  return readJSON(SETTINGS_FILE, {});
}

function getAdminStatus(req) {
  return Boolean(req.session && req.session.isAdmin);
}

function requireAdmin(req, res, next) {
  if (getAdminStatus(req)) {
    return next();
  }

  return res.status(401).json({ success: false, error: 'Admin authentication required.' });
}

function deleteFileIfExists(filePath) {
  if (!filePath) return;
  const resolved = path.join(ROOT_DIR, filePath.replace(/^\//, ''));
  if (fs.existsSync(resolved)) {
    fs.unlinkSync(resolved);
  }
}

function serialiseSong(song) {
  return {
    ...song,
    file_size_mb: song.file_size_bytes ? (song.file_size_bytes / (1024 * 1024)).toFixed(2) : null,
    audio_format: song.audio_file ? path.extname(song.audio_file).replace('.', '').toUpperCase() || 'AUDIO' : 'AUDIO',
  };
}

app.get('/api/public/settings', (req, res) => {
  const settings = getSettings();
  res.json({
    storageCapacityGb: settings.storageCapacityGb || 50,
    bandwidthGbMonthly: settings.bandwidthGbMonthly || 250,
    costEstimate: settings.costEstimate || 'Shared hosting for managed music libraries often starts around $5-$20/month.',
    notes: settings.notes || 'Keep file sizes controlled and monitor monthly transfer for heavy download traffic.',
  });
});

app.get('/api/songs', (req, res) => {
  const songs = getAllSongs().filter((song) => song.is_published).map(serialiseSong);
  res.json({ songs });
});

app.get('/api/song/:id', (req, res) => {
  const song = getSongById(req.params.id);

  if (!song || !song.is_published) {
    return res.status(404).json({ success: false, error: 'Song not found.' });
  }

  res.json({ song: serialiseSong(song) });
});

app.get('/download/:id', (req, res) => {
  const songs = getAllSongs();
  const song = songs.find((item) => item.id === req.params.id);

  if (!song || !song.is_published) {
    return res.status(404).send('Song not found or not published for public download.');
  }

  const filePath = path.join(ROOT_DIR, song.audio_file.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Audio file no longer exists on the server.');
  }

  const extension = path.extname(filePath).toLowerCase();
  const safeName = `${sanitizeFileName(song.artist)}-${sanitizeFileName(song.title)}${extension}`;

  song.download_count = Number(song.download_count || 0) + 1;
  saveSongs(songs);

  const downloads = readJSON(DOWNLOADS_FILE, []);
  downloads.unshift({
    id: uuidv4(),
    song_id: song.id,
    title: song.title,
    artist: song.artist,
    timestamp: new Date().toISOString(),
  });
  writeJSON(DOWNLOADS_FILE, downloads.slice(0, 2000));

  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('Content-Type', 'audio/*');
  return res.download(filePath, safeName);
});

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: getAdminStatus(req) });
});

app.post('/api/admin/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.adminUser = username;
    return res.json({ success: true, message: 'Authentication successful.' });
  }

  return res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out.' });
  });
});

app.get('/api/admin/songs', requireAdmin, (req, res) => {
  const songs = getAllSongs().map(serialiseSong);
  res.json({ songs });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const songs = getAllSongs();
  const downloads = readJSON(DOWNLOADS_FILE, []);

  res.json({
    totalSongs: songs.length,
    publishedSongs: songs.filter((song) => song.is_published).length,
    draftSongs: songs.filter((song) => !song.is_published).length,
    totalDownloads: songs.reduce((sum, song) => sum + Number(song.download_count || 0), 0),
    featuredSongs: songs.filter((song) => song.is_featured).length,
    recentDownloads: downloads.slice(0, 10),
  });
});

app.patch('/api/admin/songs/:id/publish', requireAdmin, (req, res) => {
  const songs = getAllSongs();
  const song = songs.find((item) => item.id === req.params.id);

  if (!song) {
    return res.status(404).json({ success: false, error: 'Song not found.' });
  }

  song.is_published = parseBoolean(req.body.is_published);
  song.updated_at = new Date().toISOString();
  saveSongs(songs);

  return res.json({ success: true, song: serialiseSong(song) });
});

app.post('/api/admin/songs', requireAdmin, uploadMedia.fields([{ name: 'audioFile', maxCount: 1 }, { name: 'coverArt', maxCount: 1 }]), (req, res) => {
  try {
    const songs = getAllSongs();
    const existingSongId = String(req.body.songId || '').trim();
    const title = String(req.body.title || '').trim();
    const artist = String(req.body.artist || '').trim();
    const genre = String(req.body.genre || 'General').trim();
    const releaseDate = String(req.body.releaseDate || new Date().toISOString().slice(0, 10)).trim();
    const description = String(req.body.description || '').trim();
    const isFeatured = parseBoolean(req.body.featured);
    const isNewRelease = parseBoolean(req.body.newRelease);
    const isPublished = parseBoolean(req.body.published);

    if (!title || !artist) {
      return res.status(400).json({ success: false, error: 'Song title and artist are required.' });
    }

    const audioFile = req.files && req.files.audioFile && req.files.audioFile[0];
    const coverFile = req.files && req.files.coverArt && req.files.coverArt[0];

    const existingSong = existingSongId ? songs.find((song) => song.id === existingSongId) : null;

    let targetSong = existingSong || {
      id: uuidv4(),
      created_at: new Date().toISOString(),
      download_count: 0,
    };

    if (audioFile) {
      if (targetSong.audio_file) {
        deleteFileIfExists(targetSong.audio_file);
      }
      targetSong.audio_file = `/uploads/audio/${audioFile.filename}`;
      targetSong.file_size_bytes = audioFile.size;
      targetSong.audio_format = path.extname(audioFile.originalname).toLowerCase().replace('.', '').toUpperCase();
    }

    if (coverFile) {
      if (targetSong.cover_art && targetSong.cover_art !== '/default-cover.svg') {
        deleteFileIfExists(targetSong.cover_art);
      }
      targetSong.cover_art = `/uploads/covers/${coverFile.filename}`;
    }

    if (!targetSong.audio_file && !existingSong) {
      return res.status(400).json({ success: false, error: 'Audio file is required when creating a new song.' });
    }

    targetSong.title = title;
    targetSong.artist = artist;
    targetSong.genre = genre;
    targetSong.release_date = releaseDate;
    targetSong.description = description;
    targetSong.is_featured = isFeatured;
    targetSong.is_new_release = isNewRelease;
    targetSong.is_published = isPublished;
    targetSong.updated_at = new Date().toISOString();
    targetSong.cover_art = targetSong.cover_art || '/default-cover.svg';

    if (!existingSong) {
      songs.unshift(targetSong);
    } else {
      const index = songs.findIndex((song) => song.id === existingSongId);
      songs[index] = targetSong;
    }

    saveSongs(songs);
    return res.json({ success: true, song: serialiseSong(targetSong) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Something went wrong while saving the song.' });
  }
});

app.delete('/api/admin/songs/:id', requireAdmin, (req, res) => {
  const songs = getAllSongs();
  const index = songs.findIndex((song) => song.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Song not found.' });
  }

  const song = songs[index];
  if (song.audio_file) deleteFileIfExists(song.audio_file);
  if (song.cover_art && song.cover_art !== '/default-cover.svg') deleteFileIfExists(song.cover_art);

  songs.splice(index, 1);
  saveSongs(songs);

  return res.json({ success: true, message: 'Song deleted.' });
});

app.get('/default-cover.svg', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'default-cover.svg'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'admin.html'));
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: error.message });
  }

  if (error) {
    return res.status(400).json({ success: false, error: error.message || 'Upload failed.' });
  }

  return next();
});

app.listen(PORT, () => {
  console.log(`RedFox Music Zambia is running on http://localhost:${PORT}`);
  console.log(`Admin username: ${ADMIN_USERNAME}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
});
