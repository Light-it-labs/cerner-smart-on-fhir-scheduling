$('#slot-search-form').on('submit', function (e) {
  e.preventDefault();
  slotSearch();
});

$('#clear-slots').on('click', function (e) {
  $('#slots').html('');
  $('#slots-holder-row').hide();
});

function slotSearch() {
  clearUI();
  $('#loading-row').show();

  // Grab Slot query parameters from the slot-search-form
  var form = document.getElementById('slot-search-form');
  var slotParams = {};
  for (var i = 0; i < form.length; i++) {
    // Handle date params later
    if (form.elements[i].name.startsWith('date-')) { continue; }
    slotParams[form.elements[i].name] = form.elements[i].value;
  }
  // Appointment start date and appointment end date need to both be set in query parameter 'start'
  slotParams['start'] = { $ge: form.elements['date-start'].value + 'T00:00:00Z', $lt: form.elements['date-end'].value + 'T00:00:00Z' };
  slotParams['service-type'] = slotParams['slot-type'];
  console.log('Slot Search slotParams: ', slotParams);
  FHIR.oauth2.ready(function (smart) {
    console.log('Slot Search FHIR.oauth2.ready');
    // Query the FHIR server for Slots
    smart.api.fetchAll({ type: 'Slot', query: slotParams }).then(

      // Display Appointment information if the call succeeded
      function (slots) {
        console.log('Slot Search ended');
        // If any Slots matched the criteria, display them
        if (slots.length) {
          var slotsHTML = '';
          const [system, code] = slotParams['service-type'].split('|');

          slots.forEach(function (slot) {
            var serviceType = slot.serviceType[0].coding.find((st) => st.code === code);
            slotsHTML = slotsHTML + slotHTML(slot.id, serviceType, slot.start, slot.end, slotParams['-location']);
          });

          renderSlots(slotsHTML);
        }
        // If no Slots matched the criteria, inform the user
        else {
          renderSlots('<p>No Slots found for the selected query parameters.</p>');
        }
      },

      // Display 'Failed to read Slots from FHIR server' if the call failed
      function () {
        clearUI();
        $('#errors').html('<p>Failed to read Slots from FHIR server</p>');
        $('#errors-row').show();
      }
    );
  });
}

function slotHTML(id, serviceType, start, end, locationId) {
  console.log('Slot: id:[' + id + '] type:[' + serviceType.display + '] start:[' + start + '] end:[' + end + ']');

  var slotReference = 'Slot/' + id,
    prettyStart = new Date(start),
    prettyEnd = new Date(end);

  return "<div class='card'>" +
    "<div class='card-body'>" +
    "<h5 class='card-title'>" + serviceType.display + '</h5>' +
    "<p class='card-text'>Start: " + prettyStart + '</p>' +
    "<p class='card-text'>End: " + prettyEnd + '</p>' +
    "<a href='javascript:void(0);' class='card-link' onclick='appointmentCreate(\"" +
    slotReference + "\", \"Patient/12508016\", \"Location/" + locationId + "\", \"" + start + "\",\"" + end + "\",\"" + serviceType.system + "\",\"" + serviceType.code + "\",\"" + serviceType.display + "\");'>Book</a>" +
    '</div>' +
    '</div>';
}

function renderSlots(slotsHTML) {
  clearUI();
  $('#slots').html(slotsHTML);
  $('#slots-holder-row').show();
}

function clearUI() {
  $('#errors').html('');
  $('#errors-row').hide();
  $('#loading-row').hide();
  $('#slots').html('');
  $('#slots-holder-row').hide();
  $('#appointment').html('');
  $('#appointment-holder-row').hide();
  $('#patient-search-create-row').hide();
};

$('#clear-appointment').on('click', function (e) {
  $('#appointment').html('');
  $('#appointment-holder-row').hide();
});

function appointmentCreate(slotReference, patientReference, locationReference, start, end, systemTypeSystem, systemTypeCode, systemTypeDisplay) {
  clearUI();
  $('#loading-row').show();
  console.log('appointmentCreate params: ', slotReference, patientReference, locationReference, start, end, systemTypeSystem, systemTypeCode, systemTypeDisplay);

  var appointmentBody = appointmentJSON(slotReference, patientReference, locationReference, start, end, systemTypeSystem, systemTypeCode, systemTypeDisplay);
  console.log('Appointment Body: ', appointmentBody);

  // FHIR.oauth2.ready handles refreshing access tokens
  FHIR.oauth2.ready(function (smart) {
    smart.api.create({ resource: appointmentBody }).then(

      // Display Appointment information if the call succeeded
      function (appointment) {
        renderAppointment(appointment.headers('Location'));
      },

      // Display 'Failed to write Appointment to FHIR server' if the call failed
      function () {
        clearUI();
        $('#errors').html('<p>Failed to write Appointment to FHIR server</p>');
        $('#errors-row').show();
      }
    );
  });
}

function appointmentJSON(slotReference, patientReference, locationReference, start, end, systemTypeSystem, systemTypeCode, systemTypeDisplay) {
  return {
    resourceType: 'Appointment',
    slot: [
      {
        reference: slotReference
      }
    ],
    participant: [
      {
        actor: {
          reference: patientReference
        },
        status: 'needs-action'
      },
      {
        actor: {
          reference: locationReference
        },
        status: "needs-action"
      }
    ],
    requestedPeriod: [
      {
        start: start,
        end: end
      }
    ],
    "serviceType": [
      {
        "coding": [
          {
            "system": systemTypeSystem,
            "code": systemTypeCode,
            "display": systemTypeDisplay
          }
        ]
      }
    ],
    status: 'proposed'
  };
}

function renderAppointment(appointmentLocation) {
  clearUI();
  $('#appointment').html('<p>Created Appointment ' + appointmentLocation.match(/\d+$/)[0] + '</p>');
  $('#appointment-holder-row').show();
}