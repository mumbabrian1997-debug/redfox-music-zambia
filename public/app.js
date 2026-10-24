const publicList = document.getElementById('libraryList');
const latestList = document.getElementById('latestList');
const featuredList = document.getElementById('featuredList');
const trendingList = document.getElementById('trendingList');
const template = document.getElementById('songCardTemplate');
const searchInput = document.getElementById('searchInput');
const genreFilter = document.getElementById('genreFilter');
const artistFilter = document.getElementById('artistFilter');

let allSongs = [];

async function loadSongs() {
  const response = await fetch('/api/songs');
  const payload = await response.json();
  allSongs = payload.songs || [];

  populateFilters();
  renderLibrary();
  updateStats();
}

function populateFilters() {
  const genres = [...new Set(allSongs.map((song) => song.genre).filter(Boolean))].sort();
  const artists = [...new Set(allSongs.map((song) => song.artist).filter(Boolean))].sort();

  genreFilter.innerHTML = '<option value="all">All genres</option>' + genres.map((genre) => `<option value="${genre}">${genre}</option>`).join('');
  artistFilter.innerHTML = '<option value="all">All artists</option>' + artists.map((artist) => `<option value="${artist}">${artist}</option>`).join('');
}

function renderLibrary() {
  const searchValue = searchInput.value.trim().toLowerCase();
  const selectedGenre = genreFilter.value;
  const selectedArtist = artistFilter.value;

  const filtered = allSongs.filter((song) => {
    const matchesSearch = !searchValue || `${song.title} ${song.artist}`.toLowerCase().includes(searchValue);
    const matchesGenre = selectedGenre === 'all' || song.genre === selectedGenre;
    const matchesArtist = selectedArtist === 'all' || song.artist === selectedArtist;
    return matchesSearch && matchesGenre && matchesArtist;
  });

  const latest = [...filtered].sort((a, b) => new Date(b.release_date || b.created_at) - new Date(a.release_date || a.created_at)).slice(0, 8);
  const featured = filtered.filter((song) => song.is_featured).slice(0, 8);
  const trending = [...filtered].sort((a, b) => Number(b.download_count || 0) - Number(a.download_count || 0)).slice(0, 8);

  latestList.innerHTML = '';
  featuredList.innerHTML = '';
  trendingList.innerHTML = '';
  publicList.innerHTML = '';

  renderCards(latest, latestList);
  renderCards(featured, featuredList);
  renderCards(trending, trendingList);
  renderCards(filtered, publicList);
}

function renderCards(songs, container) {
  if (!songs.length) {
    container.innerHTML = '<p class="muted">No tracks match this search yet.</p>';
    return;
  }

  songs.forEach((song) => {
    const clone = template.content.firstElementChild.cloneNode(true);
    const cover = clone.querySelector('.cover');
    const title = clone.querySelector('.song-title');
    const artist = clone.querySelector('.artist-name');
    const description = clone.querySelector('.description');
    const format = clone.querySelector('.format');
    const size = clone.querySelector('.file-size');
    const releaseDate = clone.querySelector('.release-date');
    const badge = clone.querySelector('.song-badge');
    const audio = clone.querySelector('audio');
    const downloadLink = clone.querySelector('.download-btn');
    const downloadsCount = clone.querySelector('.downloads-count');

    cover.src = song.cover_art || '/default-cover.svg';
    cover.alt = `${song.title} cover artwork`;
    title.textContent = song.title;
    artist.textContent = song.artist;
    description.textContent = song.description || 'Fresh release from RedFox Music Zambia.';
    format.textContent = song.audio_format || 'MP3';
    size.textContent = song.file_size_mb ? `${song.file_size_mb} MB` : 'Audio';
    releaseDate.textContent = formatDate(song.release_date || song.created_at);
    downloadsCount.textContent = `${Number(song.download_count || 0)} downloads`;
    badge.textContent = song.is_new_release ? 'New' : song.is_featured ? 'Featured' : 'Audio';
    audio.src = song.audio_file || '';
    downloadLink.href = `/download/${song.id}`;
    downloadLink.setAttribute('download', '');

    container.appendChild(clone);
  });
}

function formatDate(value) {
  if (!value) return 'Latest';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function updateStats() {
  document.getElementById('stat-total-songs').textContent = String(allSongs.length);
  document.getElementById('stat-downloads').textContent = String(allSongs.reduce((sum, song) => sum + Number(song.download_count || 0), 0));
  document.getElementById('stat-artists').textContent = String(new Set(allSongs.map((song) => song.artist)).size);
}

searchInput.addEventListener('input', renderLibrary);
genreFilter.addEventListener('change', renderLibrary);
artistFilter.addEventListener('change', renderLibrary);

loadSongs();
