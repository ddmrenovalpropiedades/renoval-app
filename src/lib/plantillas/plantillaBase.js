// ════════════════════════════════════════════════════════════════
// Plantilla base: contrato de arriendo habitacional
// Texto idéntico al generador actual (ContratoGeneratorPage.js).
// Se carga como versión 1 en Supabase; desde ahí se edita en la app.
// ════════════════════════════════════════════════════════════════
import { p, doc, docInline } from './dsl';

export const SLUG_ARRIENDO = 'arriendo-habitacional';

const DENOM_FIADORES = '{{n:fiadores|Fiador y Codeudor Solidario|Fiadores y Codeudores Solidarios}}';

export const PLANTILLA_ARRIENDO_BASE = {
  formato: 1,
  titulo: 'CONTRATO DE ARRENDAMIENTO',

  // Rol bajo cada firma
  firmas: {
    propietarios: 'ARRENDADOR',
    arrendatarios: 'ARRENDATARIO',
    fiadores: 'FIADOR Y CODEUDOR SOLIDARIO',
  },

  // Cómo se redacta cada persona en una lista; se unen con "separador"
  formatosPersona: {
    propietario: {
      nombre: 'Propietario (comparecencia)',
      grupo: 'propietarios',
      separador: ' ',
      cuerpo: docInline('{{g:persona|don|doña}} **{{p_nombre}}**, de nacionalidad {{p_nacionalidad}}, cédula de identidad N°{{p_rut}}, {{g:persona|domiciliado|domiciliada}} en {{p_domicilio}};'),
    },
    arrendatario: {
      nombre: 'Arrendatario (comparecencia)',
      grupo: 'arrendatarios',
      separador: ' ',
      cuerpo: docInline('{{g:persona|don|doña}} **{{p_nombre}}**, de nacionalidad {{p_nacionalidad}}, cédula de identidad N°{{p_rut}}, número telefónico: +569{{p_telefono}}; correo electrónico: {{p_email}}, {{g:persona|domiciliado|domiciliada}} en {{p_domicilio}};'),
    },
    fiador: {
      nombre: 'Fiador (comparecencia)',
      grupo: 'fiadores',
      separador: ' y ',
      cuerpo: docInline('{{g:persona|don|doña}} **{{p_nombre}}**, de nacionalidad {{p_nacionalidad}}, cédula de identidad N°{{p_rut}}, número telefónico: +569{{p_telefono}}; correo electrónico: {{p_email}}, {{g:persona|domiciliado|domiciliada}} en {{p_domicilio}};'),
    },
    fiador_nombre: {
      nombre: 'Fiador (solo nombre)',
      grupo: 'fiadores',
      separador: ' y ',
      cuerpo: docInline('{{g:persona|don|doña}} **{{p_nombre}}**'),
    },
  },

  // Trozos de texto que se insertan dentro de un párrafo solo si se cumple la condición
  fragmentos: {
    comparecencia_fiadores: {
      nombre: 'Comparecencia de fiadores',
      condicion: 'con_fiador',
      cuerpo: docInline(`, y {{lista:fiador}} en su calidad de **${DENOM_FIADORES}**`),
    },
    promo: {
      nombre: 'Renta promocional',
      condicion: 'con_promo',
      cuerpo: docInline(' No obstante lo anterior, durante los meses de {{meses_promo}}, la renta será de **{{promo_numero}} ({{promo_palabras}}) mensuales**.'),
    },
  },

  secciones: [
    { id: 'portada', tipo: 'bloque', bloque: 'portada' },

    {
      id: 'comparecencia',
      tipo: 'texto',
      lineaDespues: true,
      cuerpo: doc(
        p('En Santiago de Chile, **{{fecha_dia}}** de **{{fecha_mes}}** del año **{{fecha_anio}}**, entre {{lista:propietario}} **en adelante también {{n:propietarios|denominada|denominados}} como la parte** **"Arrendadora"**, por una parte y {{lista:arrendatario}} en adelante también {{n:arrendatarios|denominada|denominados}} como la parte **"Arrendataria"**{{frag:comparecencia_fiadores}}; todos ellos mayores de edad, quienes debidamente facultados acuerdan celebrar el presente Contrato de Arrendamiento, en adelante también denominado "Contrato", que consta de las cláusulas que a continuación se detallan:'),
      ),
    },

    {
      id: 'propiedad',
      tipo: 'clausula',
      titulo: 'DE LA PROPIEDAD',
      cuerpo: doc(
        p('La parte Arrendadora, declara ser dueña {{descripcion_inmueble}}, comuna de **{{comuna_prop}}**, **{{region_prop}}**, en adelante {{n:inmueble|denominado|denominados}} como "el Inmueble".'),
      ),
    },

    {
      id: 'arrendamiento',
      tipo: 'clausula',
      titulo: 'DEL ARRENDAMIENTO',
      cuerpo: doc(
        p('Por el presente instrumento, la parte Arrendadora da en arrendamiento a la parte Arrendataria, el Inmueble singularizado en la cláusula primera precedente, para ser destinado a habitación y residencia de éste.'),
        p('Las partes dejan constancia que el inmueble se arrienda amoblado, con los muebles y enseres que se identifican en inventario que debidamente suscrito por los contratantes, se entiende formar parte de este contrato para todos los efectos a que haya lugar.', { condicion: 'amoblado' }),
        p('Las partes dejan constancia que el inmueble se arrienda sin muebles, salvo aquellos que se entienden formar parte del mismo, los cuales se identifican en inventario que debidamente suscrito por los contratantes, se entiende formar parte de este contrato para todos los efectos a que haya lugar.', { condicion: 'sin_muebles' }),
      ),
    },

    {
      id: 'plazo',
      tipo: 'clausula',
      titulo: 'DEL PLAZO',
      cuerpo: doc(
        p('El presente contrato comenzará a regir el día **{{fecha_dia}}** del mes de **{{fecha_mes}}** del año **{{fecha_anio}}** y tendrá vigencia de un año, esto es, hasta el día **{{fin_dia}}** de **{{fin_mes}}** del año **{{fin_anio}}**. Vencido dicho plazo el contrato se renovará tácita, automática y sucesivamente por períodos iguales de (6) meses cada uno, a menos que alguna de las partes diere aviso a la otra de su voluntad de ponerle término, lo que deberá hacer por escrito, con a lo menos 60 días de anticipación al vencimiento del período inicial o de una cualquiera de sus prórrogas, aviso que deberá hacerse por medio de correo electrónico a la dirección fdm@renovalpropiedades.com.'),
      ),
    },

    {
      id: 'renta',
      tipo: 'clausula',
      titulo: 'DE LA RENTA',
      cuerpo: doc(
        p('La renta de arrendamiento será la suma de **{{renta_numero}} ({{renta_palabras}}) mensuales**, que la parte arrendataria pagará mediante transferencia electrónica a la cuenta corriente número 27624332 del Banco Santander a nombre de Renoval Gestión Inmobiliaria Limitada; Rut: 78.299.346-1; mail: fdm@renovalpropiedades.com los primeros cinco días de cada mes. La renta de arrendamiento de {{fecha_mes}} de {{fecha_anio}} corresponderá al **proporcional de los días de ocupación del mes**.{{frag:promo}}'),
      ),
    },

    {
      id: 'pago',
      tipo: 'clausula',
      titulo: 'DEL PAGO',
      cuerpo: doc(
        p('El simple retardo en el pago de toda o parte de la renta mensual de arrendamiento, constituirá en mora la parte Arrendataria, quedando este obligado a pagar a título de multa, la cantidad de 0.5 Unidades de Fomento por cada día de atraso, en su equivalente en pesos al día de pago, conjuntamente con la renta adeudada. Además, en el evento de mora indicado, y si fuere del caso, serán de cargo de la parte Arrendataria todos los costos que la cobranza de la renta pudiere acarrear a la parte Arrendadora.'),
        p('La parte Arrendataria autoriza a la parte Arrendadora para que, en caso de el retardo, mora o incumplimiento de cualquiera de las obligaciones contraídas en el presente contrato, los datos personales y demás derivados del presente contrato, puedan ser ingresados, procesados, tratados y comunicados al registro o banco BOLETIN ELECTRONICO DICOM (Sistema de Morosidades y Protestos).'),
        p('Adicionalmente, el solo retraso en el pago de la renta de arrendamiento y/o servicios, dará derecho a la parte Arrendadora para poner término anticipado al arrendamiento en la forma establecida por la ley.'),
      ),
    },

    {
      id: 'mantencion_arrendatario',
      tipo: 'clausula',
      titulo: 'DE LA MANTENCIÓN DEL INMUEBLE A CARGO DEL ARRENDATARIO',
      cuerpo: doc(
        p('La parte Arrendataria se obliga a conservar y a mantener en perfecto estado el funcionamiento y conservación del inmueble arrendado, sus artefactos, instalaciones, elementos y otros bienes incluidos en él, efectuando oportunamente y a su exclusivo cargo, las reparaciones y gastos de conservación y mantenimiento que correspondan, y sin derecho a reembolso. Entre ellas se incluye la mantención anual de calefont, caldera y aire acondicionado, en caso de contar con estos equipos la propiedad.'),
        p('La parte Arrendataria estará obligada a pagar con toda puntualidad y a quién corresponda, los consumos de Gastos Comunes, incluidos seguros y fondo de reserva, Energía Eléctrica, Gas, Agua Potable; Teléfono, Internet, TV Cable y demás consumos. Deberá acreditar el pago de los servicios al propietario o quién lo represente al momento de pagar la renta de arrendamiento o cuando le fuere requerido. El atraso de un mes en cualquiera de los pagos indicados, dará derecho al arrendador para suspender los servicios respectivos.'),
        p('Será de cargo de la parte Arrendadora, el pago de las contribuciones e impuestos territoriales y los gastos comunes de carácter extraordinarios.'),
      ),
    },

    {
      id: 'mantencion_arrendador',
      tipo: 'clausula',
      titulo: 'DE LA MANTENCIÓN DEL INMUEBLE A CARGO DEL ARRENDADOR',
      cuerpo: doc(
        p('La parte Arrendadora entregará la propiedad con sus sistemas de gas, electricidad, agua y calefacción, como así también, todos los artefactos, como enchufes, llaves, puertas, lámparas funcionando en perfectas condiciones. Además, la propiedad se entrega recién pintada.'),
        p('Una vez entregada la propiedad la parte Arrendadora no tendrá la obligación de efectuar mejoras en la propiedad arrendada, salvo aquellas de envergadura mayor y cuyo origen sean: temblores, inundaciones e incendios ajenos a la responsabilidad de la parte Arrendataria, fallas estructurales de la construcción. En estos casos la parte Arrendataria notificará a la parte Arrendadora, y si este no procediera a iniciar las reparaciones pertinentes dentro de los cinco (5) días hábiles siguientes, la parte Arrendataria podrá hacerlas directamente y descontar su costo de la renta de arrendamiento, previa aprobación por parte de la Arrendadora del presupuesto respectivo.'),
        p('La parte Arrendadora no responderá de manera alguna por los robos, hurtos, u otros delitos contra la propiedad, ni por los daños o perjuicios producidos por actos maliciosos, incendios, inundaciones, filtraciones, explosiones, roturas de cañerías, efectos de humedad o calor, o cualquier otro de análoga naturaleza que puedan afectar al Arrendatario o a sus bienes.'),
      ),
    },

    {
      id: 'garantia',
      tipo: 'clausula',
      titulo: 'DE LA GARANTÍA',
      cuerpo: doc(
        p('A fin de garantizar la conservación del Inmueble, su restitución en el mismo estado en que se recibe, la conservación de las especies y artefactos, el pago de los perjuicios y deterioros que se causen en el Inmueble, sus servicios e instalaciones en general, y para responder igualmente del fiel cumplimiento de las estipulaciones de este contrato, la parte Arrendataria, entrega en este acto al Arrendador, la suma **equivalente a {{garantia_numero}} ({{garantia_palabras}})**, a título de garantía, que éste se obliga a devolver al término del presente contrato, dentro de los 60 (sesenta) días siguientes a la restitución de la propiedad arrendada, quedando desde luego autorizado para descontar de la cantidad mencionada, el valor efectivo de los deterioros y perjuicios de cargo de la parte Arrendataria, que se hayan ocasionados, como así mismo el valor de cuentas pendientes de Energía Eléctrica, Gas, Agua Potable, TV Cable, Teléfono, Internet, Gastos Comunes y demás consumos. La parte Arrendataria no podrá en ningún caso o circunstancia imputar la Garantía al pago de rentas insolutas, ni al arriendo del último mes que permanezca en la propiedad.'),
        p('Si la citada garantía no alcanza a cubrir los gastos, perjuicios y deterioros mencionados, y que son de cargo de la Arrendataria, éste se obliga a pagarlos a la parte Arrendadora, dentro de los 10 días siguientes a la fecha en que éste le requiera por escrito el pago correspondiente. La parte arrendadora no devolverá la garantía en caso de incumplimiento de la cláusula tercera del presente contrato.'),
      ),
    },

    {
      id: 'prohibiciones',
      tipo: 'clausula',
      titulo: 'DE LAS PROHIBICIONES AL ARRENDATARIO',
      cuerpo: doc(
        p('Queda prohibido a la parte Arrendataria: perforar paredes, hacer variaciones al inmueble; ceder en arriendo o subarrendar la propiedad sin autorización previa escrita de la parte Arrendadora; darle un uso distinto a la propiedad que el indicado en la cláusula segunda del presente contrato; causar molestias a los vecinos; realizar convenios de pago para el pago cuentas de servicio y/o de gasto común sin la autorización expresa del propietario o de la corredora Renoval Propiedades.'),
        p('La parte Arrendataria no tendrá obligación de hacer mejoras en el inmueble y las que efectuase, sólo podrán ejecutarse, previo consentimiento por escrito de la parte Arrendadora, quedando a beneficio de la propiedad, sin que la parte Arrendadora deba pagar suma alguna por ellas, cualquiera sea el carácter, naturaleza o monto de la misma.'),
        p('La parte Arrendataria no podrá introducir materiales explosivos, ni materiales inflamables, drogas no permitidas, hacer variaciones en la propiedad o causar molestias a los vecinos.'),
      ),
    },

    {
      id: 'restitucion',
      tipo: 'clausula',
      titulo: 'DE LA RESTITUCIÓN DEL INMUEBLE',
      cuerpo: doc(
        p('Producido el término de este contrato, por cualquier causa, la parte Arrendataria deberá restituir de inmediato la propiedad a la parte Arrendadora o a quién lo represente, mediante la devolución total del inmueble, la entrega de las llaves y de los recibos que acrediten el pago de los servicios de Gastos Comunes, Energía Eléctrica, Gas, Agua Potable, Teléfono, Internet, TV Cable y demás consumos, hasta el último día de ocupación de la propiedad.'),
        p('Si la parte Arrendataria de hecho no restituye el Inmueble en la forma prevista anteriormente, por cada día en que de hecho esté incumpliendo con ello o siga ocupando el inmueble arrendado, pagará a título de pena y uso indebido, la suma diaria de una Unidad de Fomento, que se devengará hasta el día en que haga entrega oficial y fehaciente del inmueble arrendado, y sin perjuicio del pago del canon de arriendo correspondiente.'),
      ),
    },

    {
      id: 'visitas',
      tipo: 'clausula',
      titulo: 'VISITAS AL INMUEBLE',
      cuerpo: doc(
        p('Se deja establecido que, en caso de término del contrato, la parte Arrendataria queda obligado a permitir que la parte Arrendadora o quién lo represente junto a terceros interesados en el arriendo de la propiedad lo puedan visitar a lo menos tres (3) veces a la semana, durante dos (2) horas cada día, en horario a definir de común acuerdo entre las partes, durante los últimos sesenta (60) días de duración del contrato.'),
        p('De igual manera, la parte Arrendataria se obliga a dar facilidades necesarias para que la parte arrendadora, o quien lo represente, pueda visitar el inmueble cuando este lo desee en horario a definir de común acuerdo.'),
      ),
    },

    {
      id: 'servicios',
      tipo: 'clausula',
      titulo: 'DE LA LINEA TELEFÓNICA Y OTROS SERVICIOS',
      cuerpo: doc(
        p('La propiedad se arrienda sin teléfono, sin Internet y sin TV Cable, quedando desde ya la parte arrendataria autorizada para contratar la línea telefónica y los otros servicios de su conveniencia, siendo de su cargo y total responsabilidad.'),
      ),
    },

    {
      id: 'domicilio',
      tipo: 'clausula',
      titulo: 'DEL DOMICILIO',
      cuerpo: doc(
        p('Para todos los efectos legales que deriven del presente contrato, las partes fijan su domicilio en la ciudad de Santiago y se someten a la Jurisdicción de sus Tribunales.'),
      ),
    },

    {
      id: 'acciones',
      tipo: 'clausula',
      titulo: 'ACCIONES JUDICIALES',
      cuerpo: doc(
        p('En la eventualidad que La parte Arrendataria, no hiciere el pago correspondiente a un mes de la renta de arrendamiento; dará derecho a la parte Arrendadora a iniciar de inmediato las acciones judiciales tendientes a pedir la restitución del inmueble, rentas impagas, consumos, deterioros del inmueble, y los gastos que se ocasionen con motivo del juicio. (Judiciales y honorarios de abogados).'),
      ),
    },

    {
      id: 'varios',
      tipo: 'clausula',
      titulo: 'VARIOS',
      cuerpo: doc(
        p('**REAJUSTABILIDAD: **El reajuste se realizará cada {{periodo_reajuste}} meses una vez comenzado el contrato de arrendamiento según las variaciones del Índice de Precios al Consumidor (IPC), considerándose para el cálculo el último valor publicado del IPC previo a la aplicación del reajuste.', { condicion: 'moneda_clp', item: true }),
        p('**REUNIONES COMUNIDAD: **Será obligación de la parte arrendataria participar en las juntas de residentes y co-propietarios, para evitar el cobro de multas por no asistencia, en caso contrario serán de cargo de la parte arrendataria.', { item: true }),
      ),
    },

    {
      id: 'fiador',
      tipo: 'clausula',
      titulo: 'FIADOR Y CODEUDOR SOLIDARIO',
      condicion: 'con_fiador',
      cuerpo: doc(
        p(`Presente en este acto {{lista:fiador_nombre}}, ya {{n:fiadores|individualizado|individualizados}} en el presente contrato, {{n:fiadores|se constituye|se constituyen}} en ${DENOM_FIADORES} de todas y cada una de las obligaciones contraídas por la parte Arrendataria en virtud del presente contrato y hasta su total extinción, y {{n:fiadores|declara que renuncia|declaran que renuncian}}, en consecuencia, a los beneficios de excusión y de división que {{n:fiadores|le|les}} pudieren corresponder de acuerdo a la Ley, aceptando desde luego y sin previa notificación, las modificaciones que las partes puedan introducirle, sea en cuanto al monto de la renta, plazo u otras estipulaciones.`),
      ),
    },

    { id: 'firmas', tipo: 'bloque', bloque: 'firmas' },
  ],
};
