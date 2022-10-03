import Button from '@mui/material/Button';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Container } from '@mui/system';
import { Alert, Autocomplete, Chip, Divider, Paper, TextField, Typography } from '@mui/material';
import SpotifyPlayer, { STATUS } from 'react-spotify-web-playback';
import React, { useEffect, useMemo, useState } from 'react';
import SpotifyWebApi from 'spotify-web-api-node';
import { throttle } from 'lodash';
import * as Tone from 'tone'


const REACT_APP_SPOTIFY_CLIENT_ID = 'c68179ef02704510be5837755473c545';
const REACT_APP_SPOTIFY_REDIRECT_URI = window.location.origin + window.location.pathname;
const REACT_APP_SPOTIFY_SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';

const theme = createTheme({
  //palette: { mode: 'dark' }
});

const KEYS = {
  0: 'C',
  1: 'C♯ / D♭',
  2: 'D',
  3: 'D♯ / E♭',
  4: 'E',
  5: 'F',
  6: 'F♯ / G♭',
  7: 'G',
  8: 'G♯ / A♭',
  9: 'A',
  10: 'A♯ / B♭',
  11: 'B',
};
KEYS[-1] = 'Unknown';

const player = new Tone.Player(window.location.origin + window.location.pathname + '/sweet-home.mp3');
Tone.loaded().then(() => {
  console.log("Sample loaded");
});

let doNotPlayUntil = 0;
setInterval(() => {
  if (!window.spotifyPlayer || !window.analysis) {
    return;
  }

  const analysis = window.analysis;

  const spotifyPlayer = window.spotifyPlayer;
  const state = spotifyPlayer.state;

  if (!state.isPlaying) {
    return;
  }

  const progressSeconds = state.progressMs / 1000;

  // if we're already playing a sample, skip.
  if (progressSeconds < doNotPlayUntil) {
    return;
  }

  // Go over the beats.
  for (const beat of analysis.beats) {
    const diff = beat.start - progressSeconds;
    // Play within 75ms of a beat
    if (Math.abs(diff) < 0.0075) {
      // play the shiz.
      player.start();
      doNotPlayUntil = progressSeconds + 8;
      return;
    }
  }
}, 10);


function App() {
  const savedToken = localStorage.getItem('rswp_token');
  let [token, setToken] = useState(savedToken || '');

  // Check for token in the URL hash.
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get("access_token");
  if (accessToken) {
    localStorage.setItem('rswp_token', accessToken);
    token = accessToken;
  }

  const playerRef = React.createRef();
  useEffect(() => {
    const spotifyPlayer = playerRef.current;

    if (spotifyPlayer) {
      window.spotifyPlayer = spotifyPlayer;
    }
  });

  const handleCallback = ({ type, ...state }) => {
    if (state.status === STATUS.ERROR && state.errorType === 'authentication_error') {
      localStorage.removeItem('rswp_token');
      setToken('');
      window.location.hash = '';
    }

  };

  const [error, setError] = useState(null);
  const [username, setUsername] = useState(null);

  const spotifyApi = useMemo(() => new SpotifyWebApi({
    clientId: REACT_APP_SPOTIFY_CLIENT_ID,
    accessToken: token,
  }), [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    spotifyApi.getMe().then(data => {
      setUsername(data.body.display_name);
    }, err => {
      setError(err + '');
    })
  });

  const [songs, setSongs] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [playSong, setPlaySong] = useState(false);

  useEffect(() => {
    if (!searchValue) {
      return;
    }

    throttle(() => {
      spotifyApi.searchTracks(searchValue, { limit: 6 }).then(res => {
        console.log(res.body);
        setSongs(res.body.tracks.items);
      }, err => {
        setError(err + '');
      })
    }, 500)();
  }, [searchValue, spotifyApi]);

  const [analysis, setAnalysis] = useState(null);
  useEffect(() => {
    if (!selectedSong) {
      return;
    }

    spotifyApi.getAudioAnalysisForTrack(selectedSong.id).then(res => {
      setAnalysis(res.body);
      setPlaySong(true);
      window.analysis = res.body;
    }, err => {
      setError(err + '');
    })

  }, [selectedSong, spotifyApi]);

  useEffect(() => {
      // Original key: G
      let keyDiff = 0;
      if (analysis?.track?.key) {
        keyDiff = analysis.track.key - 7;
      }
      console.log("keyDiff", keyDiff);
      const filter = new Tone.PitchShift(keyDiff).toDestination();

      player.connect(filter);

      if (analysis?.track?.tempo) {
        Tone.getTransport().bpm.value = analysis.track.tempo;
      }

      if (analysis?.track?.end_of_fade_in) {
        doNotPlayUntil = analysis.track.end_of_fade_in + 2;
      }

  }, [analysis]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <Container component="main" maxWidth="lg">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography variant="h1">
            Sweet Home Alabamafy
          </Typography>

          {!token && <Button
            color="success"
            size="large"
            variant="contained"
            onClick={() => {
              window.location.href = `https://accounts.spotify.com/authorize?client_id=${REACT_APP_SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(
                REACT_APP_SPOTIFY_REDIRECT_URI
              )}&scope=${encodeURIComponent(
                REACT_APP_SPOTIFY_SCOPES
              )}&response_type=token&show_dialog=true`;
            }}
          >
            Login with Spotify
          </Button>
          }

          {username &&
            <Typography variant="h3">
              Logged in as {username}
            </Typography>
          }

          {error &&
            <Alert severity="error">{error}</Alert>
          }

          {token &&
            <Autocomplete
              id="song-search-input"
              sx={{ m: 2, width: 500 }}
              options={songs}
              getOptionLabel={(song) =>
                typeof song === 'string' ? song : song.artists[0].name + " - " + song.name + ' (' + song.id + ')'
              }
              filterOptions={(x) => x}
              autoComplete
              renderInput={(params) => (
                <TextField {...params} label="Search for a song" fullWidth />
              )}
              onChange={(_, changedValue) => {
                console.log("onChange", changedValue);
                setSelectedSong(changedValue);
              }}
              onInputChange={(_, newValue) => {
                setSearchValue(newValue);
              }}
              isOptionEqualToValue={(option, value) => option.uri === value.uri}
              renderOption={(props, song) => {
                return <li {...props}>
                  {song.album.images && song.album.images[2] &&

                    <Paper variant="outlined">
                      <img alt="" src={song.album.images[2].url} />
                    </Paper>
                  }
                  <Typography xs={{ ml: 4 }} variant="body2" color="text.secondary">
                    {song.artists[0].name} - {song.name}
                  </Typography>
                </li>;
              }}
            />
          }

          <Divider sx={{ m: 7 }} variant="middle" />

          {analysis &&
            <Box sx={{ m: 2 }} >
              <Chip label={"BPM: " + Math.round(analysis.track.tempo)} />
              <Chip label={"Key: " + KEYS[analysis.track.key]} />
            </Box>
          }

          <SpotifyPlayer
            play={playSong}
            name="Sweet Home Alabamafy"
            callback={handleCallback}
            token={token}
            syncExternalDevice={false}
            uris={selectedSong ? selectedSong.uri : null}
            ref={playerRef}
          />
        </Box>

      </Container>

    </ThemeProvider>
  );
}

export default App;
