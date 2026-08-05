// Agrega dos accesos directos al menú superior: la lista de imputaciones y el
// informe agregado, ambos sobre el proyecto donde se concentran las horas.
//
// path_pattern: .*        insertion_position: html_head
//
// Ajustar PROYECTO al identificador del proyecto que centraliza las
// imputaciones en tu instalación.

$(document).ready(function() {
    var PROYECTO = 'z_asignaciones';

    // URLs relativas: funcionan igual desde cualquier host o puerto
    var urlDedicado = '/projects/' + PROYECTO + '/time_entries';
    var urlResumen  = '/projects/' + PROYECTO + '/time_entries/report';

    var estilo = 'font-weight:bold; text-transform:uppercase;';
    var botonesExtra =
        '<li><a href="' + urlDedicado + '" style="' + estilo + '">Tiempo Dedicado</a></li>' +
        '<li><a href="' + urlResumen  + '" style="' + estilo + '">Tiempo Resumen</a></li>';

    // Insertar al final del menú principal (después de "Ayuda")
    $('#top-menu ul').first().append(botonesExtra);
});
