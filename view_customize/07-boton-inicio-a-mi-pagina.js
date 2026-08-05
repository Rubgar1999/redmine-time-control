// Reapunta el botón "Inicio" del menú superior a Mi Página.
//
// Complemento del script anterior: sin esto, "Inicio" lleva a la portada y
// dispara una redirección visible.
//
// path_pattern: .*    insertion_position: html_head

$(document).ready(function() {
    // Cambia el enlace del botón "Inicio" hacia "Mi página"
    $('a.home').attr('href', '/my/page');
});

