// Premarca "Heredar miembros" al crear un proyecto.
//
// En una jerarquía de proyectos por cliente, heredar es casi siempre lo que se
// quiere; olvidarlo obliga a rehacer los permisos a mano.
//
// path_pattern: /projects/new    insertion_position: html_bottom

$(document).ready(function() {
    // Busca el checkbox de heredar miembros y lo marca automáticamente
    $('#project_inherit_members').prop('checked', true);
});
