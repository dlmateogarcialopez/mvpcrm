ALTER TABLE `leads` ADD `contactoNombre` varchar(160);--> statement-breakpoint
ALTER TABLE `leads` ADD `contactoTelefono` varchar(32);--> statement-breakpoint
ALTER TABLE `leads` ADD `contactoCorreo` varchar(320);--> statement-breakpoint
ALTER TABLE `leads` ADD `empresaNombre` varchar(160);--> statement-breakpoint
ALTER TABLE `leads` ADD `empresaCiudad` varchar(120);--> statement-breakpoint
UPDATE `leads`
SET
  `contactoNombre` = COALESCE(NULLIF(`contactoNombre`, ''), `nombreCliente`),
  `contactoTelefono` = COALESCE(NULLIF(`contactoTelefono`, ''), `telefono`),
  `contactoCorreo` = COALESCE(NULLIF(`contactoCorreo`, ''), `correo`),
  `empresaNombre` = COALESCE(`empresaNombre`, `nombreEmpresa`),
  `empresaCiudad` = COALESCE(`empresaCiudad`, `ciudad`);
