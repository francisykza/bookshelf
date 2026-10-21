// Barrera para capas decorativas (SPEC §13.1, 1.19.0): si un efecto ambiental falla, desaparece ese efecto y
// la habitación, sus objetos y los datos siguen en pie. Hasta 1.18.0 un fallo del lienzo de noche desmontaba
// toda la app y solo quedaba el fondo marrón del body.
import { Component } from 'react';

export class DecorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, key: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // Al cambiar la hora (o lo que indique `resetKey`) se vuelve a intentar
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error) {
    console.warn('[ambiente] una capa decorativa ha fallado y se ha retirado:', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
