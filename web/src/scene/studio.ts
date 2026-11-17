import * as THREE from 'three';

/**
 * Reflection environment like a product photo studio: a dark room, a large
 * softbox above and behind (soft gradient on deck and keys), a strip light
 * behind on the left (thin highlights along the edges) and a dim card in front.
 * Coordinates: laptop at the origin, front towards +z, metres.
 */
export function studioScene(): THREE.Scene {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(8, 5, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.012, 0.013), side: THREE.BackSide }),
  );
  room.position.y = 2;
  scene.add(room);

  const light = (w: number, h: number, intensity: number, pos: [number, number, number], tint = 0xffffff) => {
    const color = new THREE.Color(tint).multiplyScalar(intensity);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    mesh.position.set(...pos);
    mesh.lookAt(0, 0.05, 0);
    scene.add(mesh);
  };
  light(2.6, 1.3, 1.4, [1.0, 0.6, -1.7]); // softbox behind right: gradient on deck and keys
  light(2.6, 0.1, 7, [-0.9, 0.55, -1.5]); // strip behind left: edge highlights
  light(2.4, 0.14, 3.5, [0.6, 1.6, 1.0]); // strip above in front: front bevels
  light(0.12, 1.6, 2, [1.6, 0.7, 0.3], 0xfff2e6); // strip right
  light(1.6, 0.6, 0.3, [-0.3, 0.3, 1.8]); // fill card in front
  return scene;
}
