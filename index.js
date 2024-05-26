import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { geoInterpolate } from 'https://cdn.skypack.dev/d3-geo';
// import { geoInterpolate } from 'd3-geo'; 

function toXYZ(lat, lon, radius) {
  var phi = (90 - lat) * Math.PI / 180;
  var theta = (lon + 180) * Math.PI / 180;

  return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
  );
}


const vertex = `
  #ifdef GL_ES
  precision mediump float;
  #endif

  uniform float u_time;
  uniform float u_maxExtrusion;

  void main() {

    vec3 newPosition = position;
    if(u_maxExtrusion > 1.0) newPosition.xyz = newPosition.xyz * u_maxExtrusion + sin(u_time);
    else newPosition.xyz = newPosition.xyz * u_maxExtrusion;

    gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );

  }
`;
const fragment = `
  #ifdef GL_ES
  precision mediump float;
  #endif

  uniform float u_time;

  vec3 colorA = vec3(0.196, 0.631, 0.886);
  vec3 colorB = vec3(0.192, 0.384, 0.498);

  void main() {

    vec3  color = vec3(0.0);
    float pct   = abs(sin(u_time));
          color = mix(colorA, colorB, pct);

    gl_FragColor = vec4(color, 1.0);

  }
`;

const container = document.querySelector('.container');
const canvas    = document.querySelector('.canvas');

let
sizes,
scene,
camera,
renderer,
controls,
raycaster,
mouse,
isIntersecting,
twinkleTime,
materials,
material,
baseMesh,
minMouseDownFlag,
mouseDown,
grabbing;

const setScene = () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    30, 
    sizes.width / sizes.height, 
    1, 
    1000
  );
  camera.position.z = 100;
  
  renderer = new THREE.WebGLRenderer({
    canvas:     canvas,
    antialias:  false,
    alpha:      true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const pointLight = new THREE.PointLight(0x081b26, 17, 200);
  pointLight.position.set(-50, 0, 60);
  scene.add(pointLight);
  scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 1.5));

  raycaster         = new THREE.Raycaster();
  mouse             = new THREE.Vector2();
  isIntersecting    = false;
  minMouseDownFlag  = false;
  mouseDown         = false;
  grabbing          = false;

  setControls();
  setBaseSphere();
  setShaderMaterial();
  setMap();
  resize();
  listenTo();
  render();

}

const setControls = () => {

  controls                 = new OrbitControls(camera, renderer.domElement);
  controls.autoRotate      = true;
  controls.autoRotateSpeed = 1.2;
  controls.enableDamping   = true;
  controls.enableRotate    = true;
  controls.enablePan       = false;
  controls.enableZoom      = false;
  controls.minPolarAngle   = (Math.PI / 2) - 0.5;
  controls.maxPolarAngle   = (Math.PI / 2) + 0.5;

};

const setBaseSphere = () => {

  const baseSphere   = new THREE.SphereGeometry(19.5, 35, 35);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color:        0x0b2636, 
    transparent:  true, 
    opacity:      0.9
  });
  baseMesh = new THREE.Mesh(baseSphere, baseMaterial);
  scene.add(baseMesh);

}

const setShaderMaterial = () => {

  twinkleTime  = 0.03;
  materials    = [];
  material     = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      u_time:         { value: 1.0 },
      u_maxExtrusion: { value: 1.0 }
    },
    vertexShader:   vertex,
    fragmentShader: fragment,
  });

}

const setMap = () => {

  let   activeLatLon    = {};
  const dotSphereRadius = 20;

  const readImageData = (imageData) => {

    for(
      let i = 0, lon = -180, lat = 90; 
      i < imageData.length; 
      i += 4, lon++
    ) {

      if(!activeLatLon[lat]) activeLatLon[lat] = [];

      const red   = imageData[i];
      const green = imageData[i + 1];
      const blue  = imageData[i + 2];

      if(red < 80 && green < 80 && blue < 80)
        activeLatLon[lat].push(lon);

      if(lon === 180) {
        lon = -180;
        lat--;
      }

    }

  }

  const visibilityForCoordinate = (lon, lat) => {

    let visible = false;

    if(!activeLatLon[lat].length) return visible;

    const closest = activeLatLon[lat].reduce((prev, curr) => {
      return (Math.abs(curr - lon) < Math.abs(prev - lon) ? curr : prev);
    });

    if(Math.abs(lon - closest) < 0.5) visible = true;

    return visible;

  }

  const calcPosFromLatLonRad = (lon, lat) => {
  
    var phi   = (90 - lat)  * (Math.PI / 180);
    var theta = (lon + 180) * (Math.PI / 180);

    const x = -(dotSphereRadius * Math.sin(phi) * Math.cos(theta));
    const z = (dotSphereRadius * Math.sin(phi) * Math.sin(theta));
    const y = (dotSphereRadius * Math.cos(phi));
  
    return new THREE.Vector3(x, y, z);

  }

  const createMaterial = (timeValue) => {

    const mat                 = material.clone();
    mat.uniforms.u_time.value = timeValue * Math.sin(Math.random());
    materials.push(mat);
    return mat;

  }

  const setDots = () => {

    const dotDensity  = 3.0;
    let   vector      = new THREE.Vector3();

    for (let lat = 90, i = 0; lat > -90; lat--, i++) {

      const radius = 
        Math.cos(Math.abs(lat) * (Math.PI / 180)) * dotSphereRadius;
      const circumference = radius * Math.PI * 2;
      const dotsForLat = circumference * dotDensity;

      for (let x = 0; x < dotsForLat; x++) {

        const long = -180 + x * 360 / dotsForLat;

        if (!visibilityForCoordinate(long, lat)) continue;

        vector = calcPosFromLatLonRad(long, lat);

        const dotGeometry = new THREE.CircleGeometry(0.1, 5);
        dotGeometry.lookAt(vector);
        dotGeometry.translate(vector.x, vector.y, vector.z);

        const m     = createMaterial(i);
        const mesh  = new THREE.Mesh(dotGeometry, m);

        scene.add(mesh);

      }

    }

  }
  
  const image   = new Image;
  image.onload  = () => {

    image.needsUpdate  = true;

    const imageCanvas  = document.createElement('canvas');
    imageCanvas.width  = image.width;
    imageCanvas.height = image.height;
      
    const context = imageCanvas.getContext('2d');
    context.drawImage(image, 0, 0);
      
    const imageData = context.getImageData(
      0, 
      0, 
      imageCanvas.width, 
      imageCanvas.height
    );
    readImageData(imageData.data);

    setDots();
    
  }

  image.src = 'img/world_alpha_mini.jpg';

}

const resize = () => {

  sizes = {
    width:  container.offsetWidth,
    height: container.offsetHeight
  };

  if(window.innerWidth > 700) camera.position.z = 100;
  else camera.position.z = 140;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);

}

const mousemove = (event) => {

  isIntersecting = false;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObject(baseMesh);
  if(intersects[0]) {
    isIntersecting = true;
    if(!grabbing) document.body.style.cursor = 'pointer';
  }
  else {
    if(!grabbing) document.body.style.cursor = 'default';
  }

}

const mousedown = () => {

  if(!isIntersecting) return;

  materials.forEach(el => {
    gsap.to(
      el.uniforms.u_maxExtrusion, 
      {
        value: 1.07
      }
    );
  });

  mouseDown         = true;
  minMouseDownFlag  = false;

  setTimeout(() => {
    minMouseDownFlag = true;
    if(!mouseDown) mouseup();
  }, 500);

  document.body.style.cursor  = 'grabbing';
  grabbing                    = true;

}

const mouseup = () => {

  mouseDown = false;
  if(!minMouseDownFlag) return;

  materials.forEach(el => {
    gsap.to(
      el.uniforms.u_maxExtrusion, 
      {
        value:    1.0, 
        duration: 0.15
      }
    );
  });

  grabbing = false;
  if(isIntersecting) document.body.style.cursor = 'pointer';
  else document.body.style.cursor = 'default';

}

const listenTo = () => {

  window.addEventListener('resize',     resize.bind(this));
  window.addEventListener('mousemove',  mousemove.bind(this));
  window.addEventListener('mousedown',  mousedown.bind(this));
  window.addEventListener('mouseup',    mouseup.bind(this));

}

const render = () => {

  materials.forEach(el => {
    el.uniforms.u_time.value += twinkleTime;
  });

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render.bind(this))

}

setScene();

const drawLineBetweenTwoPoints = (startLatLon, endLatLon) => {
  const earthRadius = 20; // Radius of the globe
  const tubeThickness = 0.1

  const startXYZ = toXYZ(startLatLon[0], startLatLon[1], earthRadius);
  const endXYZ = toXYZ(endLatLon[0], endLatLon[1], earthRadius);

  const d3Interpolate = geoInterpolate(
      [startLatLon[1], startLatLon[0]],
      [endLatLon[1], endLatLon[0]]
  );
  

  const control1 = d3Interpolate(0.25);
  const control2 = d3Interpolate(0.75);

  // Increase arc height for a more pronounced curve
  const arcHeightFactor = 1.5; // Adjust this factor as needed
  const arcHeight = startXYZ.distanceTo(endXYZ) * 0.5 * arcHeightFactor + earthRadius;
  const controlXYZ1 = toXYZ(control1[1], control1[0], arcHeight);
  const controlXYZ2 = toXYZ(control2[1], control2[0], arcHeight);

  const curve = new THREE.CubicBezierCurve3(startXYZ, controlXYZ1, controlXYZ2, endXYZ);

  const geometry = new THREE.TubeGeometry(curve, 64, tubeThickness, 8);
  console.log(geometry.attributes.position.count)
  const meshMaterial = new THREE.MeshBasicMaterial({ color: "#f0f8ff" });
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  return { mesh, geometry };
}

let startTime = performance.now();

function drawAnimatedLine(mesh, geometry) {
  let timeElapsed = performance.now() - startTime;
  const progress = timeElapsed / 3000;  // Duration of the animation in milliseconds
  let totalVertices = geometry.attributes.position.count * 5
  // console.log(geometry.attributes)
  // console.log(totalVertices)
  let drawRangeCount = Math.floor(progress * totalVertices);

  if (drawRangeCount < totalVertices) {
    geometry.setDrawRange(0, drawRangeCount);
    requestAnimationFrame(() => drawAnimatedLine(mesh, geometry));
  } else {
    console.log("WE ARE DONE")
    console.log(totalVertices)
    geometry.setDrawRange(0, totalVertices);
  }
}


// const { mesh, geometry } = drawLineBetweenTwoPoints([34.0522, -118.2437], [40.7128, -74.0060]);
// scene.add(mesh);
// geometry.setDrawRange(0, 0);
// drawAnimatedLine(mesh, geometry)

// const { mesh: mesh1, geometry: geometry1 } = drawLineBetweenTwoPoints([34.0522, -118.2437], [47.6062, -122.3321]); // Miami to Seattle
// scene.add(mesh1);
// geometry1.setDrawRange(0, 0);
// drawAnimatedLine(mesh1, geometry1);

// const { mesh: mesh2, geometry: geometry2 } = drawLineBetweenTwoPoints([34.0522, -118.2437], [25.7617, -80.1918]); // Miami to Seattle
// scene.add(mesh2);
// geometry2.setDrawRange(0, 0);
// drawAnimatedLine(mesh2, geometry2);



const baseLocation = [34.0522, -118.2437]; // Coordinates for Los Angeles
const destinations = [
  [40.7128, -74.0060], // New York
  [51.5074, -0.1278],  // London
  [35.6895, 139.6917], // Tokyo
  [48.8566, 2.3522],   // Paris
  [55.7558, 37.6173],  // Moscow
  [39.9042, 116.4074], // Beijing
  [19.0760, 72.8777],  // Mumbai
];

let currentIndex = 0;

function animateNextLine(scene) {
  if (currentIndex >= destinations.length) {
    currentIndex = 0; // Reset to loop continuously
  }

  let { mesh, geometry } = drawLineBetweenTwoPoints(baseLocation, destinations[currentIndex++]);
  geometry.setDrawRange(0, 0);
  scene.add(mesh)
  drawAnimatedLine(mesh, geometry);

  setTimeout(() => animateNextLine(scene), 3000);
}

animateNextLine(scene); // Start the animation loop