// 1.159 · La red de seguridad de la app (docs/qa/ordenador-negro.md). Sin ella, un fallo al pintar desmontaba la app entera y
// solo quedaba el marrón del fondo: «el ordenador se queda en negro» en un iPhone. Lo más probable allí: la app llevaba días
// abierta, se publicó otra versión y el trozo de código del ordenador que aún no había cargado ya no existe (404; Safari dice
// «Importing a module script failed.»). Ese caso se arregla solo recargando una vez (la página nueva trae los trozos nuevos);
// cualquier otro fallo enseña la escena de Libotown (la de las pantallas de carga) con un aviso, Recargar e Ir al inicio.
import { Component } from 'react';
import { esTrozoPerdido, recargarUnaVez } from './recarga';

export class RedDeSeguridad extends Component {
  state = { error: null, recargando: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Libotown: algo no se ha pintado bien', error);
    if (esTrozoPerdido(error) && recargarUnaVez()) this.setState({ recargando: true });
  }

  render() {
    const { error, recargando } = this.state;
    if (!error) return this.props.children;
    if (recargando) {
      return (
        <p className="pantalla-carga" role="status">
          Poniendo Libotown al día…
        </p>
      );
    }
    const perdido = esTrozoPerdido(error);
    return (
      <div className="pantalla-carga red-seguridad" role="alert">
        <div className="red-seguridad__caja">
          <p className="red-seguridad__titulo">Algo no se ha abierto bien.</p>
          <p className="red-seguridad__texto">
            {perdido
              ? 'Puede que haya una versión nueva de Libotown o que se haya ido la conexión. Recarga para seguir.'
              : 'No se ha perdido nada de lo que tienes guardado. Recarga o vuelve al inicio.'}
          </p>
          <div className="red-seguridad__botones">
            <button type="button" className="red-seguridad__btn red-seguridad__btn--si" onClick={() => location.reload()}>
              Recargar
            </button>
            {/* El historial guarda lo que estaba abierto: sin vaciarlo, se volvería a abrir lo mismo */}
            <button
              type="button"
              className="red-seguridad__btn"
              onClick={() => {
                history.replaceState(null, '', '/');
                location.reload();
              }}
            >
              Ir al inicio
            </button>
          </div>
          <details className="red-seguridad__detalle">
            <summary>Detalles del fallo</summary>
            <code>{String(error?.message ?? error).slice(0, 300)}</code>
          </details>
        </div>
      </div>
    );
  }
}
