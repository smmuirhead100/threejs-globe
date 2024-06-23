import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { Vector3 } from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let API_KEY = ""
let CLIENT_ID = ""
let apiReady = false

    
async function fetchApiKey() {
  try {
    const response = await fetch('api/getEnv'); // Adjust URL if necessary
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    API_KEY = data.api;
    CLIENT_ID = data.client;
    handleClientLoad(); // Call handleClientLoad here after fetching and setting keys
  } catch (error) {
    console.error('Error fetching API Key:', error);
  }
}

fetchApiKey().then(apiKey => {
    const API_KEY=apiKey.api;
    const CLIENT_ID=apiKey.client;
    // Continue with initialization or setup that requires the API key
    handleClientLoad()
}).catch(error => {
    console.error('Failed to fetch API Key:', error);
    // Handle the error appropriately in your application
});

    function handleClientLoad() {
        console.log("HERE")
        gapi.load('client:auth2', initClient);
    }

    function initClient() {
      console.log("GAPI START")
      gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
      }).then(function () {
        console.log("LOGGED IN")
      }, function(error) {
        console.error(JSON.stringify(error, null, 2));
      });
    }
    

  function updateSignInStatus(isSignedIn) {
    if (isSignedIn && gapi.client.sheets) {
      apiReady = true;
      // listMajors()
    } else {
      gapi.auth2.getAuthInstance().signIn();
    }
  }

  function gisLoaded() {
    console.log("GOT HERE")
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
          callback: '', // defined later
        });
        gisInited = true;
        maybeEnableButtons();
      }


    const markerSvg = `<svg viewBox="-4 0 36 36">
      <path fill="currentColor" d="M14,0 C21.732,0 28,5.641 28,12.6 C28,23.963 14,36 14,36 C14,36 0,24.064 0,12.6 C0,5.641 6.268,0 14,0 Z"></path>
      <circle fill="black" cx="14" cy="14" r="7"></circle>
    </svg>`;

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const fetchSheetData = async () => {
      const { googleSheets, spreadsheetId } = await authenticateSheets();
      const range = 'Sheet1!B2:D10'; // Adjust the range to match your sheet structure

      const response = await googleSheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values;
    };

    // Gen random data
    const N = 20;
    let endLocations = [0, 0, 0, 0, 0, 0, 0, 0]

    let arcsData = []

    const Globe = new ThreeGlobe()
      .globeImageUrl('/world.jpg')

    let globalMarkerData = [];

    function updateGlobeData() {
      gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: '1b_1jISIYUwusGR95X4Bg5EqG5LHJQednazkXEr2aKHs',
        range: 'Sheet1!B2:D2000',  // Up to 1000 rows for now
      }).then(function(response) {
        const rows = response.result.values;
        if (rows.length) {
          console.log('Data retrieved from Sheets:', rows);
          const validData = rows.filter(row => row.length >= 3 && !isNaN(parseFloat(row[1])) && !isNaN(parseFloat(row[2])));

          console.log("valiud data", validData)
          
          endLocations = validData.map(row => ({
            lat: parseFloat(row[1]),  // Assuming latitude is the third column
            lng: parseFloat(row[2]),  // Assuming longitude is the second column
          }));

          arcsData = endLocations.map(loc => ({
            startLat: 34.05,  // Latitude for Los Angeles
            startLng: -118.24,  // Longitude for Los Angeles
            endLat: loc.lat,  
            endLng: loc.lng,
            color: 'white',
            initialGap: Math.random() * (endLocations.length / 2),  // About one per half sec
          }));

          Globe.arcsData(arcsData)
          Globe.arcColor('color')
          Globe.arcDashLength(0.4)
          Globe.arcStroke(.4)
          Globe.arcDashGap(4)
          Globe.arcDashInitialGap((d) => d.initialGap)
          Globe.arcDashAnimateTime(1000);

          // Schedule adding markers after the corresponding arcs have finished animating
          arcsData.forEach((arc, index) => {
              setTimeout(() => {
                  addMarker(endLocations[index]);
              }, ((arc.initialGap*1000)));  // arcDashAnimateTime is 1000 ms
          });

        } else {
          console.log('No data found.');
        }
      }, function(response) {
        console.error('Failed to get data from Sheets:', response.result.error.message);
      });
}
    function addMarker(location) {
        let newMarkerData = {
            lat: location.lat,
            lng: location.lng,
            size: 20,
            color: 'white'
        };

        // Add the new marker data to the global marker data array
        globalMarkerData.push(newMarkerData);

        // Update Globe with all marker data, both old and new
        Globe.htmlElementsData(globalMarkerData);
        console.log("window")
        console.log(window.innerWidth)
        Globe.htmlElement(d => {
            const el = document.createElement('img');  // Use an image element
            el.src = 'Hpin.png';  // Set the source of the image
            el.style.width = `90px`;                  // Set the width of the image
            el.style.height = 'auto';                 // Maintain the aspect ratio of the image
            return el;
        });
    }
    

    // Setup renderer
    const renderers = [new THREE.WebGLRenderer({ antialias: true }),  new CSS2DRenderer()];

    renderers.forEach((r, idx) => {
      r.setSize(window.innerWidth, window.innerHeight);
      if (idx == 0) {
        r.setPixelRatio(window.devicePixelRatio);
      }
      if (idx > 0) {
        // overlay additional on top of main renderer
        r.domElement.style.position = 'absolute';
        r.domElement.style.top = '0px';
        r.domElement.style.pointerEvents = 'none';
      }
      document.getElementById('globeViz').appendChild(r.domElement);
    });

    // renderer.setSize(window.innerWidth, window.innerHeight);
    // renderer.setPixelRatio(window.devicePixelRatio);
    // document.getElementById('globeViz').appendChild(renderer.domElement);

    // Setup scene
    const scene = new THREE.Scene();
    scene.add(Globe);
    scene.add(new THREE.AmbientLight(0xcccccc, Math.PI));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI));

    // Setup camera
    const camera = new THREE.PerspectiveCamera();
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    let altitudeHelper = 150

    const latitude = 34.05;
    const longitude = -118.24;
    // altitude in globe radius units
    let altitude = altitudeHelper / Globe.getGlobeRadius();
    let { x, y, z } = Globe.getCoords(latitude, longitude, altitude);
    camera.position.x = x;
    camera.position.y = y;
    camera.position.z = z

    // Add camera controls
    const latitudeInRadians = THREE.MathUtils.degToRad(latitude + 25);
    const tbControls = new OrbitControls( camera, renderers[0].domElement );

    // Lock Vertical rotation, auto rotate
    tbControls.maxPolarAngle = latitudeInRadians;
    tbControls.minPolarAngle = latitudeInRadians;
    tbControls.maxDistance = 800
    tbControls.minDistance = 200
    tbControls.autoRotate = true;
    tbControls.autoRotateSpeed *= -0.15;
    tbControls.enableDamping = true;

    // Update pov when camera moves
    Globe.setPointOfView(camera.position, Globe.position);
    tbControls.addEventListener('change', () => Globe.setPointOfView(camera.position, Globe.position));

    fetchApiKey()
      // Kick-off renderer
      // handleClientLoad()
      let lastUpdateTime = 0; // Timestamp of the last update
      async function animate() {
        requestAnimationFrame(animate);

        tbControls.update(); // Rotate independently of refresh rate

        // Get the current timestamp
        let currentTime = Date.now();
        
        // Update data every minute
        if (currentTime - lastUpdateTime > (endLocations.length * 1000)) {
          updateGlobeData();  // Call the update function
          lastUpdateTime = currentTime;  // Update the timestamp
        }
        
        renderers.forEach(renderer => renderer.render(scene, camera));
      }
      animate()