// Acepta "S" en los diálogos de confirmación.
//
// Redmine pide escribir literalmente "Sí" (con tilde) para confirmar acciones
// destructivas, lo que en teclados mal configurados es una fuente de fricción.
// Este script permite escribir "S" y completa el valor esperado antes de
// enviar el formulario, sin tocar la validación del servidor.
//
// path_pattern: .*    insertion_position: html_head

$(document).ready(function() {
    var inputConfirmacion = $('#confirm');
    
    // Si estamos en una pantalla que tiene el cuadro de confirmación
    if (inputConfirmacion.length) {
        
        // Opcional: Cambiamos el texto de instrucciones para que el usuario sepa que puede poner solo la 'S'
        var parrafoInstruccion = inputConfirmacion.prev('p');
        if (parrafoInstruccion.text().includes('Sí')) {
            parrafoInstruccion.html('Para confirmar, por favor ingresa "<strong>S</strong>" abajo.');
        }

        // Interceptamos el formulario justo antes de enviarlo al servidor
        inputConfirmacion.closest('form').on('submit', function() {
            var valor = inputConfirmacion.val().trim().toLowerCase();
            // Si el usuario escribió "s" o "S", lo rellenamos mágicamente como "Sí"
            if (valor === 's') {
                inputConfirmacion.val('Sí');
            }
        });
    }
});

