// Oculta el campo TimeTracker del formulario de imputación.
//
// El campo lo completa el cronómetro automáticamente; mostrarlo solo invita a
// marcarlo a mano y contaminar la métrica.
//
// Ajustar CUSTOM_FIELD_ID al mismo id usado en 01-cronometro-ticket.js.
// path_pattern: /time_entries    insertion_position: html_head

$(document).ready(function() {
    // Reemplaza 'XX' con el número de ID de tu campo TimeTracker (el mismo que usaste en el botón)
    var CUSTOM_FIELD_ID = '137'; // id del campo booleano "TimeTracker"


    // Busca el campo en el formulario y oculta todo el bloque (la etiqueta y el selector)
    var $campoTimeTracker = $('#time_entry_custom_field_values_' + CUSTOM_FIELD_ID);
    
    if ($campoTimeTracker.length) {
        $campoTimeTracker.closest('p').hide(); // Oculta visualmente el campo
    }
});
