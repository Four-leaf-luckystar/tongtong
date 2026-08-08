// ================= 全局变量 =================
let applemusicDb;
let applemusicParsedLyrics = [];
let applemusicCurrentLyricIndex = -1;
let applemusicNewPlaylistCoverBase64 = "";
let applemusicCurrentSearchType = '1';

window.applemusicCurrentArtist = null;
window.applemusicCurrentQueue = [];
window.applemusicCurrentQueueSource = '';
window.applemusicCurrentPlayingSong = null;
window.applemusicFavoriteSongsCount = 0;
window.applemusicFavoriteArtistsCount = 0;

// ================= 视图切换 =================
function applemusicSwitchView(viewId, element) {
    document.querySelectorAll('.applemusic-view-container').forEach(el => {
        el.classList.remove('applemusic-active');
    });
    const targetView = document.getElementById('applemusic-view-' + viewId);
    if (targetView) {
        targetView.classList.add('applemusic-active');
    }
    
    if (element) {
        document.querySelectorAll('.applemusic-nav-item').forEach(el => {
            el.classList.remove('applemusic-nav-active');
        });
        element.classList.add('applemusic-nav-active');
    }

    // 控制全局底部悬浮栏的显示与隐藏
    const floatingUI = document.querySelector('.applemusic-floating-ui');
    if (floatingUI) {
        if (viewId === 'artist' || viewId === 'playlist-detail') {
            floatingUI.style.display = 'none';
        } else {
            floatingUI.style.display = 'flex';
        }
    }

    // 滚动到顶部 (只滚动 applemusic 容器)
    const appContainer = document.getElementById('appleMusicAppUI');
    if (appContainer) {
        appContainer.scrollTo(0, 0);
    }
}

// 打开 App
function openMusicApp() {
    const appUI = document.getElementById('musicAppUI');
    if (appUI) {
        appUI.style.display = 'block';
        applemusicSwitchView('home');
    }
}

// 关闭 App 的统一函数 (兼容 HTML 中可能存在的两种写法)
function closeAppleMusicApp() {
    const appUI = document.getElementById('musicAppUI');
    if (appUI) appUI.style.display = 'none';
}
function closeMusicApp() {
    closeAppleMusicApp();
}

// ================= 提取图片主色调 =================
function applemusicSetDominantBackground(imageUrl, elementId) {
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.onload = function() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 1;
            canvas.height = 1;
            ctx.drawImage(img, 0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            const finalR = Math.floor(r * 0.5);
            const finalG = Math.floor(g * 0.5);
            const finalB = Math.floor(b * 0.5);
            const el = document.getElementById(elementId);
            if (el) el.style.backgroundColor = `rgb(${finalR}, ${finalG}, ${finalB})`;
        } catch (e) {
            const el = document.getElementById(elementId);
            if (el) el.style.backgroundColor = '#1a1a1a';
        }
    };
    img.onerror = function() {
        const el = document.getElementById(elementId);
        if (el) el.style.backgroundColor = '#1a1a1a';
    };
    img.src = imageUrl;
}

// ================= 歌手主页 =================
function applemusicOpenArtistProfile(artistId, artistName, artistPic) {
    applemusicSwitchView('artist');
    
    window.applemusicCurrentArtist = { id: artistId, name: artistName, pic: artistPic, timestamp: Date.now() };
    applemusicCheckIsFavoriteArtist(artistId);
    
    document.getElementById('applemusic-artist-page-name').innerText = artistName;
    
    const highResPic = artistPic ? artistPic.replace('100y100', '800y800') : 'https://images.unsplash.com/photo-1506157786151-b8491531f063?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    document.getElementById('applemusic-artist-header-bg').style.backgroundImage = `url('${highResPic}')`;
    document.getElementById('applemusic-artist-page-cover').src = artistPic || highResPic;
    
    applemusicSetDominantBackground(highResPic, 'applemusic-view-artist');

    const topSongsList = document.getElementById('applemusic-artist-top-songs-list');
    topSongsList.innerHTML = '<div style="padding: 20px; color: rgba(255,255,255,0.6);">加载中...</div>';
    
    fetch(`https://163api.qijieya.cn/artist/songs?id=${artistId}&limit=10`)
        .then(res => {
            if (!res.ok) throw new Error('Network response was not ok');
            return res.json();
        })
        .then(data => {
            if (data.code === 200 && data.songs) {
                topSongsList.innerHTML = '';
                const songs = data.songs.slice(0, 5);
                if(songs.length > 0) {
                    document.getElementById('applemusic-artist-page-hot').innerText = songs[0].name;
                }
                
                window.applemusicCurrentQueue = songs.map(song => ({
                    id: song.id,
                    name: song.name,
                    artist: artistName,
                    cover: song.al.picUrl ? song.al.picUrl + '?param=500y500' : ''
                }));
                window.applemusicCurrentQueueSource = artistName; 
                
                songs.forEach(song => {
                    const div = document.createElement('div');
                    div.className = 'applemusic-song-item';
                    const cover = song.al.picUrl ? song.al.picUrl + '?param=100y100' : '';
                    const highResCover = song.al.picUrl ? song.al.picUrl + '?param=500y500' : '';
                    
                    div.innerHTML = `
                        <img src="${cover}" class="applemusic-song-cover">
                        <div class="applemusic-song-details">
                            <div class="applemusic-song-name">${song.name}</div>
                            <div class="applemusic-song-album">${song.al.name}</div>
                        </div>
                        <div class="applemusic-btn-more"><svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg></div>
                    `;
                    div.onclick = () => applemusicPlaySong(song.id, song.name, artistName, highResCover);
                    topSongsList.appendChild(div);
                });
            } else {
                throw new Error('API returned error or no hotSongs');
            }
        })
        .catch(err => {
            console.error("Fetch artist songs error:", err);
            topSongsList.innerHTML = '<div style="padding: 20px; color: rgba(255,255,255,0.6);">加载失败，请稍后重试</div>';
        });
}

// ================= 播放器控制 =================
function applemusicOpenPlayer() {
    document.getElementById('applemusic-full-player').classList.add('applemusic-active');
    document.body.classList.add('applemusic-no-scroll');
}

function applemusicClosePlayer() {
    document.getElementById('applemusic-full-player').classList.remove('applemusic-active');
    document.body.classList.remove('applemusic-no-scroll');
}

function applemusicTogglePlayPause(el) {
    const audio = document.getElementById('applemusic-audio-player');
    if (!audio || !audio.src) return; 

    const isPaused = audio.paused;
    if (isPaused) {
        audio.play();
    } else {
        audio.pause();
    }
    applemusicUpdatePlayPauseUI(!isPaused);
}

function applemusicUpdatePlayPauseUI(isPaused) {
    document.querySelectorAll('.applemusic-ctrl-playpause').forEach(btn => {
        const pauseIcon = btn.querySelector('.applemusic-icon-pause');
        const playIcon = btn.querySelector('.applemusic-icon-play');
        if (pauseIcon && playIcon) {
            if (isPaused) {
                pauseIcon.style.display = 'none';
                playIcon.style.display = 'block';
            } else {
                pauseIcon.style.display = 'block';
                playIcon.style.display = 'none';
            }
        }
    });
}

// ================= 进度条与歌词 =================
document.addEventListener('DOMContentLoaded', () => {
    const audioPlayer = document.getElementById('applemusic-audio-player');
    const progressFill = document.getElementById('applemusic-progress-fill');
    const timeCurrent = document.getElementById('applemusic-time-current');
    const timeDuration = document.getElementById('applemusic-time-duration');
    const progressBar = document.getElementById('applemusic-progress-bar');

    if (audioPlayer) {
        audioPlayer.addEventListener('timeupdate', () => {
            const current = audioPlayer.currentTime;
            const duration = audioPlayer.duration;
            
            if (duration) {
                const percent = (current / duration) * 100;
                if (progressFill) progressFill.style.width = `${percent}%`;
                if (timeCurrent) timeCurrent.innerText = applemusicFormatTime(current);
                if (timeDuration) timeDuration.innerText = "-" + applemusicFormatTime(duration - current);
            }

            if (applemusicParsedLyrics.length > 0) {
                let newIndex = applemusicParsedLyrics.findIndex(l => l.time > current) - 1;
                if (newIndex === -2) newIndex = applemusicParsedLyrics.length - 1; 
                if (newIndex < 0) newIndex = 0;

                if (newIndex !== applemusicCurrentLyricIndex) {
                    applemusicCurrentLyricIndex = newIndex;
                    applemusicUpdateLyricsHighlight();
                }
            }
        });

        audioPlayer.addEventListener('ended', () => {
            applemusicUpdatePlayPauseUI(true);
        });
    }

    if (progressBar) {
        progressBar.addEventListener('click', (e) => {
            if (!audioPlayer || !audioPlayer.duration) return;
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            audioPlayer.currentTime = percent * audioPlayer.duration;
        });
    }

    // 绑定搜索框事件
    const searchInput = document.getElementById('applemusic-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const keyword = this.value.trim();
                if (keyword) {
                    applemusicSaveSearchHistory(keyword);
                    applemusicPerformSearch(keyword);
                }
            }
        });
    }

    // 绑定搜索类型切换
    document.querySelectorAll('.applemusic-search-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.applemusic-search-tab').forEach(t => {
                t.style.background = 'transparent';
                t.style.boxShadow = 'none';
                t.style.color = 'var(--text-secondary)';
                t.classList.remove('applemusic-active');
            });
            this.style.background = '#fff';
            this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            this.style.color = 'var(--text-main)';
            this.classList.add('applemusic-active');
            applemusicCurrentSearchType = this.getAttribute('data-type');
            
            const keyword = document.getElementById('applemusic-search-input').value.trim();
            if (keyword) {
                applemusicPerformSearch(keyword);
            }
        });
    });

    // 初始化数据库
    applemusicInitDB();
});

function applemusicFormatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' + s : s}`;
}

function applemusicParseLyrics(lrcText) {
    applemusicParsedLyrics = [];
    const lines = lrcText.split('\n');
    const regex = /\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/;
    
    lines.forEach(line => {
        const match = regex.exec(line);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseFloat(match[2]);
            const text = match[3].trim();
            if (text) {
                applemusicParsedLyrics.push({ time: minutes * 60 + seconds, text });
            }
        }
    });
    applemusicRenderLyrics();
}

function applemusicRenderLyrics() {
    const container = document.getElementById('applemusic-lyrics-container');
    if (!container) return;
    container.innerHTML = '';
    if (applemusicParsedLyrics.length === 0) {
        container.innerHTML = '<div class="applemusic-lyric-line applemusic-active" style="text-align:center; margin-top:50px;">纯音乐，请欣赏</div>';
        return;
    }
    applemusicParsedLyrics.forEach((lyric, index) => {
        const div = document.createElement('div');
        div.className = 'applemusic-lyric-line';
        div.id = `applemusic-lyric-${index}`;
        div.innerText = lyric.text;
        container.appendChild(div);
    });
    applemusicCurrentLyricIndex = -1;
}

function applemusicUpdateLyricsHighlight() {
    if (applemusicCurrentLyricIndex < 0 || applemusicParsedLyrics.length === 0) return;
    const lyricLines = document.querySelectorAll('.applemusic-lyric-line');
    const container = document.getElementById('applemusic-lyrics-container');
    
    lyricLines.forEach(l => l.classList.remove('applemusic-active'));
    const activeLine = document.getElementById(`applemusic-lyric-${applemusicCurrentLyricIndex}`);
    if (activeLine && container) {
        activeLine.classList.add('applemusic-active');
        const containerHeight = container.offsetHeight;
        const lineOffset = activeLine.offsetTop;
        const lineHeight = activeLine.offsetHeight;
        container.scrollTo({
            top: lineOffset - containerHeight / 2 + lineHeight / 2,
            behavior: 'smooth'
        });
    }
}

function applemusicToggleLyricsView() {
    const mainView = document.getElementById('applemusic-player-main-view');
    const listView = document.getElementById('applemusic-player-list-view');
    const lyricsView = document.getElementById('applemusic-player-lyrics-view');
    const toggleListBtn = document.getElementById('applemusic-toggle-list-btn');
    
    if (lyricsView.style.display === 'none' || lyricsView.style.display === '') {
        mainView.style.display = 'none';
        listView.style.display = 'none';
        lyricsView.style.display = 'flex';
        if (toggleListBtn) toggleListBtn.classList.remove('applemusic-active-icon');
        setTimeout(applemusicUpdateLyricsHighlight, 100);
    } else {
        mainView.style.display = 'block';
        lyricsView.style.display = 'none';
    }
}

function applemusicTogglePlayerListView() {
    const mainView = document.getElementById('applemusic-player-main-view');
    const listView = document.getElementById('applemusic-player-list-view');
    const lyricsView = document.getElementById('applemusic-player-lyrics-view');
    const toggleListBtn = document.getElementById('applemusic-toggle-list-btn');
    
    if (listView.style.display === 'none' || listView.style.display === '') {
        mainView.style.display = 'none';
        lyricsView.style.display = 'none';
        listView.style.display = 'flex';
        if (toggleListBtn) toggleListBtn.classList.add('applemusic-active-icon');
    } else {
        mainView.style.display = 'block';
        listView.style.display = 'none';
        if (toggleListBtn) toggleListBtn.classList.remove('applemusic-active-icon');
    }
}

function applemusicToggleUpNextMode(mode) {
    const btnShuffle = document.getElementById('applemusic-btn-shuffle');
    const btnRepeat = document.getElementById('applemusic-btn-repeat');
    const btnRepeatOne = document.getElementById('applemusic-btn-repeat-one');

    if(btnShuffle) btnShuffle.classList.remove('applemusic-active');
    if(btnRepeat) btnRepeat.classList.remove('applemusic-active');
    if(btnRepeatOne) btnRepeatOne.classList.remove('applemusic-active');

    if (mode === 'shuffle' && btnShuffle) {
        btnShuffle.classList.add('applemusic-active');
    } else if (mode === 'repeat' && btnRepeat) {
        btnRepeat.classList.add('applemusic-active');
    } else if (mode === 'repeat-one' && btnRepeatOne) {
        btnRepeatOne.classList.add('applemusic-active');
    }
}

// ================= 播放逻辑 =================
function applemusicPlaySong(id, name, artist, cover) {
    window.applemusicCurrentPlayingSong = { id, name, artist, cover, timestamp: Date.now() };
    
    applemusicCheckIsFavorite(id);
    applemusicSaveRecentPlay(window.applemusicCurrentPlayingSong);

    const miniTitle = document.getElementById('applemusic-mini-title');
    const miniCover = document.getElementById('applemusic-mini-cover');
    if(miniTitle) miniTitle.innerText = name;
    if(miniCover) miniCover.innerHTML = `<img src="${cover}" style="width:100%; height:100%; border-radius:10px; object-fit:cover;">`;
    
    const artistBottomTitle = document.getElementById('applemusic-artist-bottom-title');
    const artistBottomArtist = document.getElementById('applemusic-artist-bottom-artist');
    const artistBottomCover = document.getElementById('applemusic-artist-bottom-cover');
    if(artistBottomTitle) artistBottomTitle.innerText = name;
    if(artistBottomArtist) artistBottomArtist.innerText = artist;
    if(artistBottomCover) artistBottomCover.innerHTML = `<img src="${cover}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    
    const playlistBottomTitle = document.getElementById('applemusic-playlist-bottom-title');
    const playlistBottomArtist = document.getElementById('applemusic-playlist-bottom-artist');
    const playlistBottomCover = document.getElementById('applemusic-playlist-bottom-cover');
    if(playlistBottomTitle) playlistBottomTitle.innerText = name;
    if(playlistBottomArtist) playlistBottomArtist.innerText = artist;
    if(playlistBottomCover) playlistBottomCover.innerHTML = `<img src="${cover}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;

    const largeTitle = document.getElementById('applemusic-large-title');
    const largeArtist = document.getElementById('applemusic-large-artist');
    const largeCoverImg = document.getElementById('applemusic-large-cover-img');
    const playerBg = document.querySelector('.applemusic-player-bg');
    if(largeTitle) largeTitle.innerText = name;
    if(largeArtist) largeArtist.innerText = artist;
    if(largeCoverImg) largeCoverImg.src = cover;
    if(playerBg) playerBg.style.backgroundImage = `url('${cover}')`;
    
    const listCurrentTitle = document.getElementById('applemusic-list-current-title');
    const listCurrentArtist = document.getElementById('applemusic-list-current-artist');
    const listCurrentCover = document.getElementById('applemusic-list-current-cover');
    if(listCurrentTitle) listCurrentTitle.innerText = name;
    if(listCurrentArtist) listCurrentArtist.innerText = artist;
    if(listCurrentCover) listCurrentCover.src = cover;
    
    const audio = document.getElementById('applemusic-audio-player');
    if(audio) {
        audio.src = `https://api.qijieya.cn/meting?server=netease&type=url&id=${id}`;
        audio.play().catch(err => {
            console.error("播放失败:", err);
        });
    }
    
    applemusicUpdatePlayPauseUI(false);
    applemusicRenderUpNextList();

    // 歌词
    const lyricsTitle = document.getElementById('applemusic-lyrics-title');
    const lyricsArtist = document.getElementById('applemusic-lyrics-artist');
    const lyricsCoverImg = document.getElementById('applemusic-lyrics-cover-img');
    const lyricsContainer = document.getElementById('applemusic-lyrics-container');
    
    if(lyricsTitle) lyricsTitle.innerText = name;
    if(lyricsArtist) lyricsArtist.innerText = artist;
    if(lyricsCoverImg) lyricsCoverImg.src = cover;
    
    if(lyricsContainer) {
        lyricsContainer.innerHTML = '<div class="applemusic-lyric-line applemusic-active" style="text-align:center; margin-top:50px;">加载歌词中...</div>';
        fetch(`https://api.qijieya.cn/meting/?server=netease&type=lrc&id=${id}`)
            .then(res => res.text())
            .then(textData => {
                let rawLrc = "";
                try {
                    const jsonData = JSON.parse(textData);
                    if (jsonData.lrc && jsonData.lrc.lyric) rawLrc = jsonData.lrc.lyric;
                    else if (jsonData.lyric) rawLrc = jsonData.lyric;
                    else if (typeof jsonData === 'string') rawLrc = jsonData;
                } catch (e) {
                    rawLrc = textData;
                }

                if (rawLrc && rawLrc.trim() !== "") {
                    applemusicParseLyrics(rawLrc);
                } else {
                    lyricsContainer.innerHTML = '<div class="applemusic-lyric-line applemusic-active" style="text-align:center; margin-top:50px;">纯音乐，请欣赏</div>';
                }
            })
            .catch(err => {
                console.error("获取歌词失败", err);
                lyricsContainer.innerHTML = '<div class="applemusic-lyric-line applemusic-active" style="text-align:center; margin-top:50px;">暂无歌词</div>';
            });
    }
}

function applemusicRenderUpNextList() {
    const container = document.getElementById('applemusic-up-next-container');
    if (!container) return;
    
    const subtitle = document.getElementById('applemusic-up-next-subtitle');
    if (subtitle) {
        subtitle.innerText = '来自' + (window.applemusicCurrentQueueSource || '未知');
    }

    container.innerHTML = '';
    
    if (!window.applemusicCurrentQueue || window.applemusicCurrentQueue.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">暂无待播歌曲</div>';
        return;
    }

    let currentIndex = window.applemusicCurrentQueue.findIndex(s => s.id == window.applemusicCurrentPlayingSong.id);
    if (currentIndex === -1) currentIndex = 0;

    const nextSongs = window.applemusicCurrentQueue.slice(currentIndex + 1);
    
    if (nextSongs.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">已经是最后一首</div>';
        return;
    }

    nextSongs.forEach(song => {
        const div = document.createElement('div');
        div.className = 'applemusic-list-item';
        div.onclick = () => applemusicPlaySong(song.id, song.name, song.artist, song.cover);
        
        div.innerHTML = `
            <img src="${song.cover}" class="applemusic-list-cover">
            <div class="applemusic-list-info">
                <div class="applemusic-list-title">${song.name}</div>
                <div class="applemusic-list-artist">${song.artist}</div>
            </div>
            <div class="applemusic-action-btn applemusic-list-star-btn" style="background: transparent;" onclick="event.stopPropagation(); applemusicToggleSpecificStar(this, '${song.id}', '${song.name.replace(/'/g, "\\'")}', '${song.artist.replace(/'/g, "\\'")}', '${song.cover}')">
                <svg class="applemusic-star-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round" style="width: 20px; height: 20px;">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
                <svg class="applemusic-star-filled" style="display:none; width: 20px; height: 20px;" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.1 2.41c.31-.8 1.49-.8 1.8 0l2.2 5.67a1 1 0 00.83.6l6.05.46c.85.06 1.2 1.12.55 1.68l-4.64 3.97a1 1 0 00-.32 1l1.38 5.9c.2.85-.68 1.49-1.4 1.05l-5.18-3.15a1 1 0 00-1.04 0l-5.18 3.15c-.72.44-1.6-.2-1.4-1.05l1.38-5.9a1 1 0 00-.32-1L1.17 10.82c-.65-.56-.3-1.62.55-1.68l6.05-.46a1 1 0 00.83-.6l2.2-5.67z"/>
                </svg>
            </div>
        `;
        container.appendChild(div);
        applemusicCheckSpecificIsFavorite(song.id, div.querySelector('.applemusic-list-star-btn'));
    });
}

// ================= 搜索逻辑 =================
function applemusicPerformSearch(keyword) {
    const recentSearchSection = document.getElementById('applemusic-recent-search-section');
    const searchResultsSection = document.getElementById('applemusic-search-results-section');
    const searchResultsList = document.getElementById('applemusic-search-results-list');

    if(recentSearchSection) recentSearchSection.style.display = 'none';
    if(searchResultsSection) searchResultsSection.style.display = 'block';
    if(searchResultsList) searchResultsList.innerHTML = '<div style="padding: 20px; color: #8e8e93;">搜索中...</div>';

    fetch(`https://163api.qijieya.cn/cloudsearch?keywords=${encodeURIComponent(keyword)}&type=${applemusicCurrentSearchType}`)
        .then(res => res.json())
        .then(data => {
            if (data.code === 200 && data.result) {
                if (applemusicCurrentSearchType === '1' && data.result.songs) {
                    applemusicRenderSearchResults(data.result.songs, 'song');
                } else if (applemusicCurrentSearchType === '100' && data.result.artists) {
                    applemusicRenderSearchResults(data.result.artists, 'artist');
                } else {
                    if(searchResultsList) searchResultsList.innerHTML = '<div style="padding: 20px; color: #8e8e93;">未找到结果</div>';
                }
            } else {
                if(searchResultsList) searchResultsList.innerHTML = '<div style="padding: 20px; color: #8e8e93;">未找到结果</div>';
            }
        })
        .catch(err => {
            console.error(err);
            if(searchResultsList) searchResultsList.innerHTML = '<div style="padding: 20px; color: #8e8e93;">搜索失败，请重试</div>';
        });
}

function applemusicRenderSearchResults(items, type) {
    const searchResultsList = document.getElementById('applemusic-search-results-list');
    if(!searchResultsList) return;
    searchResultsList.innerHTML = '';
    
    if (type === 'song') {
        window.applemusicCurrentQueue = items.map(item => ({
            id: item.id,
            name: item.name,
            artist: item.ar.map(a => a.name).join(', '),
            cover: item.al.picUrl ? item.al.picUrl + '?param=500y500' : ''
        }));
        window.applemusicCurrentQueueSource = '搜索'; 
    }
    
    items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'applemusic-chart-item';
        div.style.cursor = 'pointer';
        div.style.padding = '10px 0'; 
        
        if (type === 'song') {
            const artistName = item.ar.map(a => a.name).join(', ');
            const thumbCover = item.al.picUrl ? item.al.picUrl + '?param=100y100' : ''; 
            const highResCover = item.al.picUrl ? item.al.picUrl + '?param=500y500' : ''; 
            
            div.innerHTML = `
                <img src="${thumbCover}" style="width: 46px; height: 46px; border-radius: 6px; margin-right: 14px; object-fit: cover; background: rgba(0,0,0,0.05); flex-shrink: 0;">
                <div class="applemusic-chart-name" style="flex: 1; overflow: hidden;">
                    <div style="font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                    <div style="font-size: 13px; color: #8e8e93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${artistName}</div>
                </div>
            `;
            div.onclick = () => applemusicPlaySong(item.id, item.name, artistName, highResCover);
        } else if (type === 'artist') {
            const artistPic = (item.picUrl || item.img1v1Url) ? (item.picUrl || item.img1v1Url) + '?param=100y100' : '';
            
            div.innerHTML = `
                <img src="${artistPic}" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 14px; object-fit: cover; background: rgba(0,0,0,0.05); flex-shrink: 0;">
                <div class="applemusic-chart-name" style="flex: 1; overflow: hidden;">
                    <div style="font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                    <div style="font-size: 13px; color: #8e8e93; margin-top: 2px;">歌手</div>
                </div>
            `;
            div.onclick = () => applemusicOpenArtistProfile(item.id, item.name, artistPic);
        }
        
        searchResultsList.appendChild(div);
    });
}

// ================= IndexedDB 数据库操作 =================
function applemusicInitDB() {
    if (typeof applemusicLoadAllData === 'function') {
        applemusicLoadAllData();
    }
}

function applemusicLoadAllData() {
    if (typeof musicAppData === 'undefined') return;
    applemusicLoadSearchHistory();
    applemusicLoadRecentPlays();
    applemusicLoadFavoriteCount();
    applemusicLoadCustomPlaylists();
    applemusicLoadFavoriteArtistCount();
}

function applemusicSaveSearchHistory(keyword) {
    if (typeof musicAppData === 'undefined') return;
    const index = musicAppData.searchHistory.findIndex(item => item.keyword === keyword);
    if (index !== -1) {
        musicAppData.searchHistory.splice(index, 1);
    }
    musicAppData.searchHistory.push({ keyword: keyword, timestamp: Date.now() });
    if (typeof saveMusicAppData === 'function') saveMusicAppData();
    applemusicLoadSearchHistory();
}

function applemusicLoadSearchHistory() {
    if (typeof musicAppData === 'undefined') return;
    const history = [...musicAppData.searchHistory].sort((a, b) => b.timestamp - a.timestamp);
    const recentSearchList = document.getElementById('applemusic-recent-search-list');
    if(!recentSearchList) return;
    recentSearchList.innerHTML = '';
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'applemusic-recent-search-item';
        div.innerHTML = `
            <svg class="applemusic-recent-search-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <div class="applemusic-recent-search-text">${item.keyword}</div>
            <div class="applemusic-recent-search-delete" onclick="applemusicDeleteSearchHistory('${item.keyword}', this)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 10.5858L9.17157 7.75736L7.75736 9.17157L10.5858 12L7.75736 14.8284L9.17157 16.2426L12 13.4142L14.8284 16.2426L16.2426 14.8284L13.4142 12L16.2426 9.17157L14.8284 7.75736L12 10.5858Z"></path></svg>
            </div>
        `;
        div.onclick = (e) => {
            if(!e.target.closest('.applemusic-recent-search-delete')) {
                const searchInput = document.getElementById('applemusic-search-input');
                if(searchInput) searchInput.value = item.keyword;
                applemusicPerformSearch(item.keyword);
            }
        };
        recentSearchList.appendChild(div);
    });
    applemusicBindLongPressEvent();
}

function applemusicDeleteSearchHistory(keyword, element) {
    if (typeof musicAppData === 'undefined') return;
    musicAppData.searchHistory = musicAppData.searchHistory.filter(item => item.keyword !== keyword);
    if (typeof saveMusicAppData === 'function') saveMusicAppData();
    element.parentElement.remove();
}

function applemusicSaveRecentPlay(song) {
    if (typeof musicAppData === 'undefined') return;
    const index = musicAppData.recentPlays.findIndex(item => item.id === song.id);
    if (index !== -1) {
        musicAppData.recentPlays.splice(index, 1);
    }
    song.timestamp = Date.now();
    musicAppData.recentPlays.push(song);
    if (typeof saveMusicAppData === 'function') saveMusicAppData();
    applemusicLoadRecentPlays();
}

function applemusicLoadRecentPlays() {
    if (typeof musicAppData === 'undefined') return;
    const plays = [...musicAppData.recentPlays].sort((a, b) => b.timestamp - a.timestamp);
    const recentPlayList = document.getElementById('applemusic-recent-play-list');
    if(!recentPlayList) return;
    recentPlayList.innerHTML = '';
    plays.forEach(song => {
        const div = document.createElement('div');
        div.className = 'applemusic-song-item';
        div.onclick = () => {
            window.applemusicCurrentQueue = plays; 
            window.applemusicCurrentQueueSource = '最近听歌'; 
            applemusicPlaySong(song.id, song.name, song.artist, song.cover);
        };
        div.innerHTML = `
            <div class="applemusic-song-cover" style="background-image: url('${song.cover}');"></div>
            <div class="applemusic-song-info">
                <div class="applemusic-song-name">${song.name}</div>
                <div class="applemusic-song-artist">${song.artist}</div>
            </div>
        `;
        recentPlayList.appendChild(div);
    });
}

function applemusicBindLongPressEvent() {
    const recentItems = document.querySelectorAll('.applemusic-recent-search-item');
    let pressTimer;

    recentItems.forEach(item => {
        const startPress = () => {
            pressTimer = setTimeout(() => {
                document.querySelectorAll('.applemusic-recent-search-item').forEach(el => {
                    el.classList.add('applemusic-edit-mode');
                });
            }, 500); 
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
        };

        item.addEventListener('touchstart', startPress);
        item.addEventListener('touchend', cancelPress);
        item.addEventListener('touchmove', cancelPress);

        item.addEventListener('mousedown', startPress);
        item.addEventListener('mouseup', cancelPress);
        item.addEventListener('mouseleave', cancelPress);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.applemusic-recent-search-item')) {
            document.querySelectorAll('.applemusic-recent-search-item').forEach(el => {
                el.classList.remove('applemusic-edit-mode');
            });
        }
    });
}

// ================= 收藏逻辑 =================
function applemusicToggleStar(el) {
    if (!window.applemusicCurrentPlayingSong) {
        alert("请先播放一首歌曲");
        return;
    }
    
    el.classList.toggle('applemusic-active');
    const outline = el.querySelector('.applemusic-star-outline');
    const filled = el.querySelector('.applemusic-star-filled');
    const isActive = el.classList.contains('applemusic-active');
    
    if (isActive) {
        if(outline) outline.style.display = 'none';
        if(filled) filled.style.display = 'block';
        applemusicSaveFavoriteSong(window.applemusicCurrentPlayingSong);
    } else {
        if(outline) outline.style.display = 'block';
        if(filled) filled.style.display = 'none';
        applemusicRemoveFavoriteSong(window.applemusicCurrentPlayingSong.id);
    }
    
    document.querySelectorAll('.applemusic-star-btn').forEach(btn => {
        if (btn !== el) {
            if (isActive) {
                btn.classList.add('applemusic-active');
                const o = btn.querySelector('.applemusic-star-outline');
                const f = btn.querySelector('.applemusic-star-filled');
                if(o) o.style.display = 'none';
                if(f) f.style.display = 'block';
            } else {
                btn.classList.remove('applemusic-active');
                const o = btn.querySelector('.applemusic-star-outline');
                const f = btn.querySelector('.applemusic-star-filled');
                if(o) o.style.display = 'block';
                if(f) f.style.display = 'none';
            }
        }
    });
}

function applemusicSaveFavoriteSong(song) {
    if (typeof musicAppData === 'undefined') return;
    const index = musicAppData.favoriteSongs.findIndex(item => item.id === song.id);
    if (index === -1) {
        musicAppData.favoriteSongs.push(song);
        if (typeof saveMusicAppData === 'function') saveMusicAppData();
        applemusicLoadFavoriteCount();
    }
}

function applemusicRemoveFavoriteSong(id) {
    if (typeof musicAppData === 'undefined') return;
    musicAppData.favoriteSongs = musicAppData.favoriteSongs.filter(item => item.id !== id);
    if (typeof saveMusicAppData === 'function') saveMusicAppData();
    applemusicLoadFavoriteCount();
}

function applemusicLoadFavoriteCount() {
    if (typeof musicAppData === 'undefined') return;
    window.applemusicFavoriteSongsCount = musicAppData.favoriteSongs.length;
}

function applemusicCheckIsFavorite(id) {
    if (typeof musicAppData === 'undefined') return;
    const isFav = musicAppData.favoriteSongs.some(item => item.id === id);
    document.querySelectorAll('.applemusic-star-btn:not(#applemusic-view-artist .applemusic-star-btn)').forEach(btn => {
        if (isFav) {
            btn.classList.add('applemusic-active');
            const o = btn.querySelector('.applemusic-star-outline');
            const f = btn.querySelector('.applemusic-star-filled');
            if(o) o.style.display = 'none';
            if(f) f.style.display = 'block';
        } else {
            btn.classList.remove('applemusic-active');
            const o = btn.querySelector('.applemusic-star-outline');
            const f = btn.querySelector('.applemusic-star-filled');
            if(o) o.style.display = 'block';
            if(f) f.style.display = 'none';
        }
    });
}

function applemusicToggleSpecificStar(el, id, name, artist, cover) {
    const isActive = el.classList.contains('applemusic-active');
    const outline = el.querySelector('.applemusic-star-outline');
    const filled = el.querySelector('.applemusic-star-filled');
    
    if (!isActive) {
        el.classList.add('applemusic-active');
        if(outline) outline.style.display = 'none';
        if(filled) filled.style.display = 'block';
        applemusicSaveFavoriteSong({id, name, artist, cover, timestamp: Date.now()});
    } else {
        el.classList.remove('applemusic-active');
        if(outline) outline.style.display = 'block';
        if(filled) filled.style.display = 'none';
        applemusicRemoveFavoriteSong(id);
    }
    
    if (window.applemusicCurrentPlayingSong && window.applemusicCurrentPlayingSong.id == id) {
        applemusicCheckIsFavorite(id);
    }
}

function applemusicCheckSpecificIsFavorite(id, el) {
    if (typeof musicAppData === 'undefined' || !el) return;
    const isFav = musicAppData.favoriteSongs.some(item => item.id === id);
    if (isFav) {
        el.classList.add('applemusic-active');
        const o = el.querySelector('.applemusic-star-outline');
        const f = el.querySelector('.applemusic-star-filled');
        if(o) o.style.display = 'none';
        if(f) f.style.display = 'block';
    }
}

function applemusicToggleArtistStar(el) {
    if (!window.applemusicCurrentArtist) return;
    
    el.classList.toggle('applemusic-active');
    const outline = el.querySelector('.applemusic-star-outline');
    const filled = el.querySelector('.applemusic-star-filled');
    const isActive = el.classList.contains('applemusic-active');
    
    if (isActive) {
        if(outline) outline.style.display = 'none';
        if(filled) filled.style.display = 'block';
        applemusicSaveFavoriteArtist(window.applemusicCurrentArtist);
    } else {
        if(outline) outline.style.display = 'block';
        if(filled) filled.style.display = 'none';
        applemusicRemoveFavoriteArtist(window.applemusicCurrentArtist.id);
    }
}

function applemusicSaveFavoriteArtist(artist) {
    if (typeof musicAppData === 'undefined') return;
    const index = musicAppData.favoriteArtists.findIndex(item => item.id === artist.id);
    if (index === -1) {
        musicAppData.favoriteArtists.push(artist);
        if (typeof saveMusicAppData === 'function') saveMusicAppData();
        applemusicLoadFavoriteArtistCount();
    }
}

function applemusicRemoveFavoriteArtist(id) {
    if (typeof musicAppData === 'undefined') return;
    musicAppData.favoriteArtists = musicAppData.favoriteArtists.filter(item => item.id !== id);
    if (typeof saveMusicAppData === 'function') saveMusicAppData();
    applemusicLoadFavoriteArtistCount();
}

function applemusicLoadFavoriteArtistCount() {
    if (typeof musicAppData === 'undefined') return;
    window.applemusicFavoriteArtistsCount = musicAppData.favoriteArtists.length;
}

function applemusicCheckIsFavoriteArtist(id) {
    if (typeof musicAppData === 'undefined') return;
    const isFav = musicAppData.favoriteArtists.some(item => item.id === id);
    const btn = document.querySelector('#applemusic-view-artist .applemusic-star-btn');
    if(btn) {
        if (isFav) {
            btn.classList.add('applemusic-active');
            const o = btn.querySelector('.applemusic-star-outline');
            const f = btn.querySelector('.applemusic-star-filled');
            if(o) o.style.display = 'none';
            if(f) f.style.display = 'block';
        } else {
            btn.classList.remove('applemusic-active');
            const o = btn.querySelector('.applemusic-star-outline');
            const f = btn.querySelector('.applemusic-star-filled');
            if(o) o.style.display = 'block';
            if(f) f.style.display = 'none';
        }
    }
}

// ================= 歌单逻辑 =================
function applemusicOpenCreatePlaylistModal() {
    const modal = document.getElementById('applemusic-modal-create-playlist');
    if(modal) modal.classList.add('applemusic-active');
    
    const titleInput = document.getElementById('applemusic-new-playlist-title');
    const coverImg = document.getElementById('applemusic-new-playlist-cover');
    const cameraIcon = document.getElementById('applemusic-camera-icon-wrapper');
    
    if(titleInput) titleInput.value = '';
    if(coverImg) {
        coverImg.style.display = 'none';
        coverImg.src = '';
    }
    if(cameraIcon) cameraIcon.style.display = 'flex';
    
    applemusicNewPlaylistCoverBase64 = "";
    applemusicCheckPlaylistTitle();
}

function applemusicCloseCreatePlaylistModal() {
    const modal = document.getElementById('applemusic-modal-create-playlist');
    if(modal) modal.classList.remove('applemusic-active');
}

function applemusicCheckPlaylistTitle() {
    const titleInput = document.getElementById('applemusic-new-playlist-title');
    const btn = document.getElementById('applemusic-btn-submit-playlist');
    if(!titleInput || !btn) return;
    
    const title = titleInput.value.trim();
    if (title.length > 0) {
        btn.classList.add('applemusic-active');
    } else {
        btn.classList.remove('applemusic-active');
    }
}

function applemusicTriggerCoverUpload() {
    const choice = confirm("点击【确定】选择本地相册上传，点击【取消】输入图片URL");
    if (choice) {
        const fileInput = document.getElementById('applemusic-cover-file-input');
        if(fileInput) fileInput.click();
    } else {
        const url = prompt("请输入图片URL:");
        if (url) {
            applemusicSetPlaylistCover(url);
        }
    }
}

function applemusicHandleCoverFile(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            applemusicSetPlaylistCover(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

function applemusicSetPlaylistCover(src) {
    applemusicNewPlaylistCoverBase64 = src;
    const img = document.getElementById('applemusic-new-playlist-cover');
    const cameraIcon = document.getElementById('applemusic-camera-icon-wrapper');
    if(img) {
        img.src = src;
        img.style.display = 'block';
    }
    if(cameraIcon) cameraIcon.style.display = 'none';
}

function applemusicSubmitCreatePlaylist() {
    const titleInput = document.getElementById('applemusic-new-playlist-title');
    if(!titleInput) return;
    const title = titleInput.value.trim();
    if (!title) return;

    const playlist = {
        id: Date.now().toString(),
        title: title,
        cover: applemusicNewPlaylistCoverBase64 || "", 
        timestamp: Date.now()
    };

    if (typeof musicAppData === 'undefined') return;
    musicAppData.customPlaylists.push(playlist);
    if (typeof saveMusicAppData === 'function') saveMusicAppData();
    
    applemusicCloseCreatePlaylistModal();
    applemusicLoadCustomPlaylists();
}

function applemusicLoadCustomPlaylists() {
    if (typeof musicAppData === 'undefined') return;
    const playlists = [...musicAppData.customPlaylists].sort((a, b) => b.timestamp - a.timestamp);
    const container = document.getElementById('applemusic-my-playlists-container');
    if(!container) return;
    
    while (container.children.length > 1) {
        container.removeChild(container.lastChild);
    }
    
    const heartPlaylist = container.children[0];
    if(heartPlaylist) {
        heartPlaylist.onclick = () => applemusicOpenPlaylistDetail({
            title: '心动歌曲',
            cover: '' 
        });
    }

    playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'applemusic-pl-item';
        
        const coverHtml = pl.cover 
            ? `<img src="${pl.cover}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`
            : `<svg viewBox="0 0 24 24" fill="#c7c7cc" style="width:32px; height:32px;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

        div.innerHTML = `
            <div class="applemusic-tiny-star-placeholder"></div>
            <div class="applemusic-pl-cover applemusic-custom" style="padding:0; overflow:hidden; border:none;">
                ${coverHtml}
            </div>
            <div class="applemusic-pl-info">${pl.title}</div>
            <svg class="applemusic-lib-list-chevron" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
        `;
        div.onclick = () => applemusicOpenPlaylistDetail(pl);
        container.appendChild(div);
    });
}

function applemusicTogglePlaylistLayout() {
    const container = document.getElementById('applemusic-my-playlists-container');
    if(container) container.classList.toggle('applemusic-grid-view');
}

function applemusicOpenPlaylistDetail(playlist) {
    applemusicSwitchView('playlist-detail');
    
    const coverWrapper = document.getElementById('applemusic-detail-playlist-cover-wrapper');
    if(coverWrapper) {
        if (playlist.title === '心动歌曲') {
            coverWrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="var(--theme-active)" style="width: 80px; height: 80px;"><path d="M11.1 2.41c.31-.8 1.49-.8 1.8 0l2.2 5.67a1 1 0 00.83.6l6.05.46c.85.06 1.2 1.12.55 1.68l-4.64 3.97a1 1 0 00-.32 1l1.38 5.9c.2.85-.68 1.49-1.4 1.05l-5.18-3.15a1 1 0 00-1.04 0l-5.18 3.15c-.72.44-1.6-.2-1.4-1.05l1.38-5.9a1 1 0 00-.32-1L1.17 10.82c-.65-.56-.3-1.62.55-1.68l6.05-.46a1 1 0 00.83-.6l2.2-5.67z"/></svg>`;
        } else if (playlist.cover) {
            coverWrapper.innerHTML = `<img src="${playlist.cover}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            coverWrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="#c7c7cc" style="width: 80px; height: 80px;"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
        }
    }

    const songsList = document.getElementById('applemusic-playlist-detail-songs-list');
    if(!songsList) return;
    
    songsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">加载中...</div>';
    
    if (playlist.title === '心动歌曲') {
        if (typeof musicAppData === 'undefined') {
            songsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">数据库未初始化</div>';
            return;
        }
        
        const songs = [...musicAppData.favoriteSongs].sort((a, b) => b.timestamp - a.timestamp);
        window.applemusicCurrentQueue = songs; 
        window.applemusicCurrentQueueSource = playlist.title; 
        songsList.innerHTML = '';
        
        if (songs.length === 0) {
            songsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">暂无收藏歌曲</div>';
            return;
        }

        songs.forEach(song => {
            const div = document.createElement('div');
            div.className = 'applemusic-playlist-detail-song-item';
            div.onclick = () => applemusicPlaySong(song.id, song.name, song.artist, song.cover);
            
            div.innerHTML = `
                <svg class="applemusic-playlist-detail-song-star" viewBox="0 0 24 24"><path d="M11.1 2.41c.31-.8 1.49-.8 1.8 0l2.2 5.67a1 1 0 00.83.6l6.05.46c.85.06 1.2 1.12.55 1.68l-4.64 3.97a1 1 0 00-.32 1l1.38 5.9c.2.85-.68 1.49-1.4 1.05l-5.18-3.15a1 1 0 00-1.04 0l-5.18 3.15c-.72.44-1.6-.2-1.4-1.05l1.38-5.9a1 1 0 00-.32-1L1.17 10.82c-.65-.56-.3-1.62.55-1.68l6.05-.46a1 1 0 00.83-.6l2.2-5.67z"/></svg>
                <img src="${song.cover}" class="applemusic-playlist-detail-song-cover">
                <div class="applemusic-playlist-detail-song-info">
                    <div class="applemusic-playlist-detail-song-name">${song.name}</div>
                    <div class="applemusic-playlist-detail-song-artist">${song.artist}</div>
                </div>
                <svg class="applemusic-playlist-detail-song-more" viewBox="0 0 24 24" onclick="event.stopPropagation();"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            `;
            songsList.appendChild(div);
        });
    } else {
        songsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">歌单为空</div>';
    }
}
