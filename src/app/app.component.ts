import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { SpotifyAuthService } from './spotify-auth.service';
import { Album, Artist, TrackItem } from './album.model';
import { Playlist, PlaylistItem } from './playlist.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, CommonModule, FormsModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  constructor(private spotifyAuthService: SpotifyAuthService, private http: HttpClient) { }

  private spotifyEntity: Album | Playlist | undefined;
  private prevEntityId: string = '';
  private isAlbum: boolean = true; // If the current entity is an Album
  entityUrl: string = 'https://open.spotify.com/album/0lw68yx3MhKflWFqCsGkIs?si=B6c14qAES8GYNo5fbnUdfQ';
  posterUrl: string = '';
  darkTheme: boolean = false;
  landscape: boolean = false;
  aspectRatio: number = 1;

  ngOnInit() { // ViewChild is only available after view initialization
    this.fetchSpotifyEntity();
  }

  fetchSpotifyEntity() {
    const entityId = this.extractEntityId(this.entityUrl);
    if (!entityId) {
      console.log("Unable to locate entity");
      return;
    }
    else if (entityId != this.prevEntityId) { // Prevent spamming API calls
      this.prevEntityId = entityId;
      this.spotifyAuthService.getToken().subscribe(token => {
        const entityUrl = `https://api.spotify.com/v1/${this.isAlbum ? 'albums' : 'playlists'}/${entityId}`;
        this.http.get<Album | Playlist>(entityUrl, { // Cast response to either Album or Playlist
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).subscribe(entity => {
          this.spotifyEntity = entity;
          console.log("Entity fetched: ", this.spotifyEntity.name);
          this.generatePoster();
        }, error => {
          console.error('Failed to fetch entity:', error);
        });
      });
    }
  }

  extractEntityId(entityUrl: string): string | null {
    const albumMatch = entityUrl.match(/(?:album)\/([a-zA-Z0-9]+)/);
    if (albumMatch) {
      this.isAlbum = true;
      return albumMatch[1];
    }
    const playlistMatch = entityUrl.match(/playlist\/([a-zA-Z0-9]+)/);
    if (playlistMatch) {
      this.isAlbum = false;
      return playlistMatch[1];
    }
    return null;
  } // Parse the URL to get the id of the entity and determine its type

  get spotifyAlbum(): Album | undefined {
    return this.isAlbum && this.spotifyEntity ? this.spotifyEntity as Album : undefined;
  }

  get spotifyPlaylist(): Playlist | undefined {
    return !this.isAlbum && this.spotifyEntity ? this.spotifyEntity as Playlist : undefined;
  }

  generatePoster() { // Use the canvas 2D API to draw the poster
    // ADD NICE ANIMATION WHILE GENERATING POSTER

    const highResCanvas = document.getElementById('highResCanvas') as HTMLCanvasElement;
    const highResCtx = highResCanvas.getContext('2d');

    if (this.aspectRatio == 1) {
      highResCanvas.width = 2353;
      highResCanvas.height = 3529;
    }
    else if (this.aspectRatio == 2) {
      highResCanvas.width = 2494;
      highResCanvas.height = 3325;
    }
    else if (this.aspectRatio == 3) {
      highResCanvas.width = 2160;
      highResCanvas.height = 3840;
    }

    if (this.landscape) {
      let temp = highResCanvas.width;
      highResCanvas.width = highResCanvas.height;
      highResCanvas.height = temp;
    } // Swap the dimensions of the canvas to make it landscape

    if (highResCtx) {
      highResCtx.clearRect(0, 0, highResCanvas.width, highResCanvas.height); // Clear the canvas
      const img = new Image(); // Artwork for album or playlist
      img.crossOrigin = 'anonymous'; // Set crossOrigin to allow CORS requests
      highResCtx.font = 'bold 100px spotifyFont';

      if (this.spotifyAlbum) {
        img.src = this.spotifyAlbum.images[0].url;
      }
      else if (this.spotifyPlaylist) {
        img.src = this.spotifyPlaylist.images[0].url;
      }

      if (this.darkTheme) {
        highResCtx.fillStyle = '#252525';
        highResCtx.fillRect(0, 0, highResCanvas.width, highResCanvas.height);
        highResCtx.fillStyle = '#cecdd2';
      } else {
        highResCtx.fillStyle = '#cecdd2';
        highResCtx.fillRect(0, 0, highResCanvas.width, highResCanvas.height);
        highResCtx.fillStyle = 'black';
      }

      // DEPENDS ON ORIENTATION AND ASPECT RATIO

      highResCtx.fillText(`${this.spotifyEntity?.name.toUpperCase()}`, 90, 2480, highResCanvas.width - 90);
      highResCtx.font = '300 70px roboto';

      let creatorText = '';
      let tracks: { name: string; explicit: boolean; artists?: string[] }[] = [];

      if (this.spotifyAlbum) {
        creatorText = `${this.spotifyAlbum.artists[0].name}`;
        if (this.spotifyAlbum.artists[1]) {
          creatorText += `, ${this.spotifyAlbum.artists[1].name}`;
        } if (this.spotifyAlbum.artists[2]) {
          creatorText += creatorText + `, ${this.spotifyAlbum.artists[2].name}`;
        }
        tracks = this.spotifyAlbum.tracks.items.slice(0, 20).map((track: TrackItem) => ({
          name: track.name,
          explicit: track.explicit,
        }));
      } else if (this.spotifyPlaylist) {
        creatorText = `${this.spotifyPlaylist.owner.display_name}`;
        tracks = this.spotifyPlaylist.tracks.items.slice(0, 18).map((item: PlaylistItem) => ({
          name: item.track.name,
          explicit: item.track.explicit,
          artists: item.track.artists.map((artist: Artist) => artist.name),
        }));
      }

      highResCtx.fillText(creatorText, 90, 2550, highResCanvas.width - 92); // Artist or owner text
      highResCtx.fillRect(96, 2590, highResCanvas.width - 180, 6); // Line under title and creator

      // Helper function to abbreviate text longer than maxLength
      function abbreviateText(text: string, maxLength: number): string {
        if (text.length > maxLength) {
          return text.substring(0, maxLength - 3) + '...';
        }
        return text;
      }

      // Calculate the maximum width of the longest track name
      let maxTrackWidth = 0;
      tracks.forEach((track) => {
        track.name = abbreviateText(track.name, 37);
        const text = track.name;
        const textWidth = highResCtx.measureText(text).width;
        if (textWidth > maxTrackWidth) {
          maxTrackWidth = textWidth;
        }
      });

      // Determine the font size based on the maximum track width
      let fontSize = maxTrackWidth * 0.17;
      if (tracks.length > 8) {
        fontSize /= 2;
      }
      console.log(maxTrackWidth + " " + fontSize);
      fontSize =50;
      highResCtx.font = '300 ' + fontSize + 'px roboto';

      // Split tracks into two columns if there are more than 4 tracks in each column
      let columnTotal = Math.ceil(tracks.length / 2);
      let leftColumn = tracks;
      let rightColumn: typeof tracks = [];

      if (columnTotal > 4) {
        leftColumn = tracks.slice(0, columnTotal);
        rightColumn = tracks.slice(columnTotal);
      } else {
        columnTotal = tracks.length;
      }

      // Determine the maximum width for the left column
      let maxWidth = 0;
      leftColumn.forEach((track, index) => {
        const text = abbreviateText(index + 1 + '. ' + track.name, 40);
        const textWidth = highResCtx.measureText(text).width;
        if (textWidth > maxWidth) {
          maxWidth = textWidth;
        }
      });

      const rightColumnOffset = maxWidth + 150; // Adjust this as needed for spacing

      // Draw the left column
      leftColumn.forEach((track, index) => {
        const y = 2705 + index * (1.6 * fontSize); // y position to write the text
        const text = abbreviateText(index + 1 + '. ' + track.name, 40);
        highResCtx.fillText(text, 90, y);

        if (this.spotifyPlaylist) {
          const artistY = y + 0.57 * fontSize;
          highResCtx.save();
          highResCtx.font = '300 ' + (fontSize * 0.4) + 'px Roboto'; // Smaller font for artists
          highResCtx.fillStyle = 'grey';
          highResCtx.fillText(track.artists?.join(', ') ?? '', 94 + fontSize, artistY);
          highResCtx.restore();
        }
      });

      // Draw the right column
      rightColumn.forEach((track, index) => {
        const y = 2705 + index * (1.6 * fontSize);
        const text = abbreviateText(columnTotal + index + 1 + '. ' + track.name, 40);
        highResCtx.fillText(text, rightColumnOffset, y);

        if (this.spotifyPlaylist) {
          const artistY = y + 0.57 * fontSize;
          highResCtx.save();
          highResCtx.font = '300 ' + (fontSize * 0.4) + 'px Roboto'; // Smaller font for artists
          highResCtx.fillStyle = 'grey';
          highResCtx.fillText(track.artists?.join(', ') ?? '', rightColumnOffset + fontSize, artistY);
          highResCtx.restore();
        }
      });

      // ADD RELEASE DATE/DATE CREATED, LABEL/TOTAL TRACKS AND DURATION IN M:S

      img.onload = () => { // Once entity image has been loaded...

        // Define the dimensions and position where the image is drawn
        const imageWidth = this.landscape ? highResCanvas.height : highResCanvas.width;
        const imageHeight = this.landscape ? highResCanvas.height : highResCanvas.width;

        // Draw the entity image onto the canvas according to orientation
        highResCtx.drawImage(img, 0, 0, imageWidth, imageHeight);

        // Get the image data for the area where the image was drawn
        const imageData = highResCtx.getImageData(0, 0, imageWidth, imageHeight);

        // Get the color scheme from the image data
        const commonColours = this.getColourScheme(imageData);

        // Draw a small circle in the bottom left of the poster for 5 most common colours
        const circleRadius = 30;
        commonColours.forEach((color, index) => {
          const x = 125 + index * (circleRadius * 2 + 25); // Horizontal position
          const y = highResCtx.canvas.height - circleRadius - 30;
          highResCtx.beginPath(); // Draw the circle
          highResCtx.arc(x, y, circleRadius, 0, 2 * Math.PI); // Draw circle
          highResCtx.fillStyle = color; // Set color for circle
          highResCtx.fill(); // Fill the circle with color
          highResCtx.lineWidth = 3;
          highResCtx.stroke();
        });

        // Convert the entire high-resolution canvas to a PNG
        this.posterUrl = highResCanvas.toDataURL('image/png');

        // Display the PNG in the image element
        const poster = document.getElementById('poster') as HTMLImageElement;
        poster.src = this.posterUrl;

        if (this.landscape) { // Ensure the poster fits in the window
          poster.height = 400;
        } else {
          poster.height = 600;
        }

        if (this.darkTheme) {
          poster.style.border = '3px solid white';
        } else {
          poster.style.border = '3px solid black';
        }

        poster.style.display = 'block'; // Display the image
      };
    }
  }

  downloadGraphic() {
    const link = document.createElement('a'); // Create a new HTML element programatically
    link.href = this.posterUrl; // Make the element link to the URL of the poster graphic
    link.download = this.spotifyEntity?.name + ' poster.png'; // Set a default filename for the download
    link.click(); // Simulate a click event on the element to download the image at the URL
  }

  getColourScheme(imageData: ImageData): string[] {
    const data = imageData.data;
    const colorCount: { [color: string]: number } = {};

    // Function to convert RGB to hex
    const rgbToHex = (r: number, g: number, b: number) =>
      `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;

    // Count the occurrences of each color
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const color = rgbToHex(r, g, b);
      colorCount[color] = (colorCount[color] || 0) + 1;
    }

    // Get the top 5 colors and sort them by frequency
    const topColors = Object.entries(colorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([color]) => color);

    // Return the top colors as an array of strings
    return topColors;
  }
}