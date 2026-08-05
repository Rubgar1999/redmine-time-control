// Enlace al log de auditoría de proyectos.
//
// Inyecta "Auditoría de proyectos" en el panel de administración y en el
// sidebar, con un ícono SVG embebido como data URI. Complementa al plugin
// redmine-project-audits, que expone la ruta pero no agrega la entrada de menú.
//
// path_pattern: .*    insertion_position: html_bottom

$(document).ready(function() {

  // Inyectar el ícono SVG azul en la hoja de estilos
  if ($('#audit-icon-style').length === 0) {
    var svgIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231b6fa8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 8v4l3 3'/%3E%3Cpath d='M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5'/%3E%3C/svg%3E";
    
    $('head').append(
      '<style id="audit-icon-style">' +
      'a.audit-custom-icon {' +
      '  background-image: url("' + svgIcon + '") !important;' +
      '  background-repeat: no-repeat !important;' +
      '  background-position: 0 50% !important;' +
      '  padding-left: 22px !important;' +
      '  display: inline-block !important;' +
      '  line-height: 1.5 !important;' +
      '}' +
      '</style>'
    );
  }

  // 1. LISTA PRINCIPAL DEL CENTRO (en /admin)
  if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
    if ($('#content a[href="/project_audits"]').length === 0) {
      var infoLink = $('#content a[href*="/info"]');
      
      if (infoLink.length > 0) {
        if (infoLink.parent().is('li')) {
          infoLink.parent().after('<li><a class="audit-custom-icon" href="/project_audits">Auditoría de proyectos</a></li>');
        } else {
          infoLink.after('<br><a class="audit-custom-icon" href="/project_audits" style="margin-top: 6px;">Auditoría de proyectos</a>');
        }
      }
    }
  }

  // 2. MENÚ LATERAL (#sidebar) - EXCLUYENDO CONSULTAS PERSONALIZADAS
  $('#sidebar ul').each(function() {
    var $ul = $(this);
    var isCustomQueries = $ul.closest('.queries').length > 0 || 
                          $ul.prev('h3').text().toLowerCase().indexOf('consultas') !== -1;

    if (!isCustomQueries) {
      if ($ul.find('a[href*="/users"], a[href*="/projects"], a[href*="/settings"]').length > 0) {
        if ($ul.find('a[href="/project_audits"]').length === 0) {
          $ul.append('<li><a class="audit-custom-icon" href="/project_audits">Auditoría de proyectos</a></li>');
        }
      }
    }
  });

  // 3. LIMPIEZA DE CONSULTAS PERSONALIZADAS
  $('#sidebar .queries a[href="/project_audits"]').parent('li').remove();

});

