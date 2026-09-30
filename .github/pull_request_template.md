AB#

<!-- Qué cambia y por qué. Lo que se deduce del diff no se escribe aquí. -->


### Reglas de dependencia

Solo para cambios de código.

- [ ] El controlador no contiene lógica del producto
- [ ] La entidad no sale por la API: se devuelve un DTO
- [ ] El repositorio se llama solo desde el servicio de su módulo
- [ ] Un módulo no accede a las clases internas de otro
- [ ] Las entidades de distintos módulos se relacionan por identificador
- [ ] Las llamadas al backend pasan por `lib/apiClient.js`
