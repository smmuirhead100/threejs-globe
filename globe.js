import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { Vector3 } from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontJson from './fonts/helvetiker_bold.typeface.json' assert { type: "json" };


let API_KEY = ""
let CLIENT_ID = ""
let apiReady = false
let gotData = false
    
async function fetchApiKey() {
  try {
    console.log("GETTING API")
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
        updateGlobeData()
      }, function(error) {
        console.error(JSON.stringify(error, null, 2));
      });
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // Gen random data
    const N = 20;
    let endLocations = []

    let arcsData = []

    const Globe = new ThreeGlobe()
      .globeImageUrl('/world.jpg')

    let globalMarkerData = [];

    async function updateGlobeData() {
      try {
        console.log("first pass")
        console.log(gotData)
        if (gotData == true) {
          return
        }
        gotData = true
        const response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: '1b_1jISIYUwusGR95X4Bg5EqG5LHJQednazkXEr2aKHs',
          range: 'Sheet1!B2:D2000',  // Up to 1000 rows for now
        });
        
        const rows = response.result.values;
        if (rows.length) {
          gotData = true
          console.log(gotData)
          console.log('Data retrieved from Sheets:', rows);
          const validData = rows.filter(row => row.length >= 3 && !isNaN(parseFloat(row[1])) && !isNaN(parseFloat(row[2])));
    
          console.log("valid data", validData);
    
          endLocations = validData.map(row => ({
            lat: parseFloat(row[1]),  // Assuming latitude is the third column
            lng: parseFloat(row[2]),  // Assuming longitude is the second column
          }));
    
          // Limit the number of arcs to 100
          const limitedEndLocations = endLocations.slice(-100);
    
          arcsData = limitedEndLocations.map(loc => ({
            startLat: 34.05,  // Latitude for Los Angeles
            startLng: -118.24,  // Longitude for Los Angeles
            endLat: loc.lat,
            endLng: loc.lng,
            color: 'white',
            initialGap: Math.random() * (limitedEndLocations.length / 2),  // About one per half sec
          }));
    
          console.log("ADDING ARCS DATA");
          Globe.arcsData(arcsData)
            .arcColor('color')
            .arcDashLength(0.4)
            .arcStroke(0.4)
            .arcDashGap(4)
            .arcDashInitialGap((d) => d.initialGap)
            .arcDashAnimateTime(1000);
    
          // Schedule adding markers after the corresponding arcs have finished animating
          console.log("ADDING MARKERS");
          arcsData.forEach((arc, index) => {
            setTimeout(() => {
              addMarker(limitedEndLocations[index]);
            }, ((arc.initialGap * 1000)));  // arcDashAnimateTime is 1000 ms
          });
        } else {
          console.log('No data found.');
        }
      } catch (error) {
        console.error('Failed to get data from Sheets:', error);
      }
      console.log("DONE ADDING MARKERS");
    }

    function addMarker(location) {
        let newMarkerData = {
            lat: location.lat,
            lng: location.lng,
            size: 20,
            color: 'white'
        };

        // Ensure the marker data array does not exceed 100 entries
        if (globalMarkerData.length > 100) {
            globalMarkerData.shift(); // Remove the oldest marker data
        }

        // Add the new marker data to the global marker data array
        globalMarkerData.push(newMarkerData);

        // Update Globe with all marker data, both old and new
        Globe.htmlElementsData(globalMarkerData);
        Globe.htmlElement(d => {
            const el = document.createElement('img');  // Use an image element
            el.src = 'Hpin.png';
            el.style.width = `3%`;
            el.style.height = 'auto';
            el.style.position = 'absolute'; 
            el.style.transform = 'translate(-50%, 100%)';  // Adjust the position to place the bottom of the image at the poin
            return el;
        });
    }

function addTextBehindEarth() {
  const div = document.createElement('div');
  div.className = 'behind-earth';
  div.textContent = 'BEANS WORLD';
  div.style.fontSize = Globe.getGlobeRadius();
  div.style.color = 'white';
  div.style.textAlign = 'center';
  div.style.position = 'absolute';

  const textLabel = new CSS2DObject(div);

  const latitude = 0; // Center of the globe
  const longitude = 0; // Center of the globe
  const altitude = Globe.getGlobeRadius() * 1.1; // Slightly above the globe surface
  const { x, y, z } = Globe.getCoords(latitude, longitude, altitude);
  textLabel.position.set(0, 50, 40);

  scene.add(textLabel);
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
    scene.background = new THREE.Color(0x210F29);
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

    // Disable zoom and pan
    tbControls.enableZoom = false;
    // tbControls.enablePan = false;

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
  // let currentTime = Date.now();
  
  // Update data every minute
  // if (currentTime - lastUpdateTime > (endLocations.length * 1000)) {
  //   // updateGlobeData();  // Call the update function
  //   lastUpdateTime = currentTime;  // Update the timestamp
  // }
  
  console.log("rendering")
  renderers.forEach(renderer => renderer.render(scene, camera));
}

// addTextBehindEarth();
animate()