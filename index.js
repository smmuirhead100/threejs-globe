import ThreeGlobe from './three-globe';


const myGlobe = new ThreeGlobe()
  .globeImageUrl(myImageUrl)
  .pointsData(myData);

const myScene = new THREE.Scene();
myScene.add(myGlobe);