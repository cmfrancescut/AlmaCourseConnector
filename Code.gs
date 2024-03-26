var cc = DataStudioApp.createCommunityConnector();

function getAuthType() {
  var AuthTypes = cc.AuthType;
  return cc
    .newAuthTypeResponse()
    .setAuthType(AuthTypes.NONE)
    .build();
}

function isAdminUser() {
  return true;
}

function getConfig(request) {
  var config = cc.getConfig();

  config.newInfo()
    .setId('boilerplate')
    .setText('Populate the below fields to configure your connection to the Courses API.');

  config.newTextInput()
    .setId('user_key')
    .setName('Enter your API key to connect to this data source.');

  var opt_active = config.newOptionBuilder()
    .setLabel('Active')
    .setValue('ACTIVE');

  var opt_inactive = config.newOptionBuilder()
    .setLabel('Inactive')
    .setValue('INACTIVE');

  var opt_all = config.newOptionBuilder()
    .setLabel('All courses')
    .setValue('ALL');

  config.newSelectSingle()
    .setId('course_status')
    .setName('Course Status')
    .addOption(opt_active)
    .addOption(opt_inactive)
    .addOption(opt_all);

  return config.build();
}

function getSchema(request) {
  var fields = getFields(request).build();
  return { schema: fields };
}

function getData(request) {
  try {
    // Set up schema
    var requestedFieldIds = request.fields.map(function (field) {
      return field.name;
    });
    var requestedFields = getFields().forIds(requestedFieldIds);

    //API call
    var options = {
      'muteHttpExceptions': false,
      'headers': { 'accept': 'application/json' }
    }

    // Note - Alma API limits max number of courses to 100, so we need to perform multiple API calls
    // And offset them by 100 each time, depending on the number of records returned
    var url = 'https://api-ca.hosted.exlibrisgroup.com/almaws/v1/courses?status=' + request.configParams.course_status
      + '&apikey=' + request.configParams.user_key;

    // Determine number of records
    var recordResponse = UrlFetchApp.fetch(url + '&limit=0', options);
    var numberOfRecords = JSON.parse(recordResponse.getContentText()).total_record_count;

    var allRecords = [];
    var offset = 0;

    // Concatenate records to one array
    while (offset <= numberOfRecords) {
      var response = UrlFetchApp.fetch(url + '&limit=100&offset=' + offset, options);
      var json = JSON.parse(response.getContentText()).course;

      allRecords = allRecords.concat(json);
      offset += 100;
    }

    var rows = parseData(requestedFields, allRecords, request.configParams.user_key);

    return {
      schema: requestedFields.build(),
      rows: rows
    };
  } catch (e) {
    Logger.log(e);
    cc
      .newUserError()
      .setDebugText('Error fetching and parsing data from API. Exception: ' + e)
      .setText('Please try again later.')
      .throwException();
  }
}

/**Parses the JSON data into an array of values that correspond to the following:
[course_id, course_name, course_code, course_section, course_department, course_status, start_date, end_date, course_semeseter, participants, reading_list, citations]
@return {object} rows of data
 */
function parseData(requestedFields, data, key) {
  var fields = requestedFields.asArray();
  var options = {
    'muteHttpExceptions': false,
    'headers': { 'accept': 'application/json' }
  }

  return data.map(function (course) {
    var row = [];

    //get the reading list ID
    var readingList = UrlFetchApp.fetch('https://api-ca.hosted.exlibrisgroup.com/almaws/v1/courses/' + course.id + '/reading-lists?apiKey=' + key, options);
    readingListId = JSON.parse(readingList.getContentText()).reading_list
    
    var hasReadingList = readingListId !== undefined && readingListId[0].id !== undefined;

    fields.forEach(function (field) {
      switch (field.getId() ?? '') {
        case 'course_id':
          row.push(course.id.length > 0 ? course.id : '');
          break;
        case 'course_name':
          row.push(course.name.length > 0 ? course.name : '');
          break;
        case 'course_code':
          row.push(course.code.length > 0 ? course.code : '');
          break;
        case 'course_section':
          row.push(course.section.length > 0 ? course.section : '');
          break;
        case 'course_department':
          row.push(course.academic_department && course.academic_department.desc ? course.academic_department.desc : '');
          break;
        case 'course_status':
          row.push(course.status.length > 0 ? course.status : '');
          break;
        case 'start_date':
          row.push(course.start_date ?? Date());
          break;
        case 'end_date':
          row.push(course.end_date ?? Date());
          break;
        case 'course_semester':
          row.push(course.term !== undefined ? course.term[0].desc : '')
          break;
        case 'participants':
          row.push(course.participants ?? 0);
          break;
        case 'reading_list':
          row.push(hasReadingList ? 'Yes' : 'No');
          break;
        case 'citations':
          //count citations in reading lists if they exist
          if (hasReadingList) {
            var citationResponse = UrlFetchApp.fetch(
              'https://api-ca.hosted.exlibrisgroup.com/almaws/v1/courses/' + course.id
              + '/reading-lists/' + readingListId[0].id
              + '/citations?apiKey=' + key,
              options
            );

            citations = JSON.parse(citationResponse.getContentText()).citation;
            row.push(citations !== undefined ? citations.length : 0);
          } else {
            row.push(0);
          }
          break;
        default:
          row.push('');
      }
    });

    return { values: row };
  })
}

/** 
 * Returns the field definitions for the schema, based on Alma's definition of the course object in their API.
 * @return {object} representation of the course object
 */
function getFields() {
  var fields = cc.getFields();
  var types = cc.FieldType;

  fields.newDimension()
    .setId('course_id')
    .setName('Alma Course ID')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('course_name')
    .setName('Course Name')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('course_code')
    .setName('Course Code')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('course_section')
    .setName('Section')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('course_department')
    .setName('Department')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('course_status')
    .setName('Status')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('start_date')
    .setName('Start Date')
    .setType(types.YEAR_MONTH_DAY);

  fields.newDimension()
    .setId('end_date')
    .setName('End Date')
    .setType(types.YEAR_MONTH_DAY);

  fields.newDimension()
    .setId('course_semester')
    .setName('Semester')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('participants')
    .setName('Students Enrolled')
    .setType(types.NUMBER);

  fields.newDimension()
    .setId('reading_list')
    .setName('Reading list')
    .setDescription('Course has reading list')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('citations')
    .setName('Citations')
    .setDescription('Number of Citations')
    .setType(types.NUMBER);

  return fields;
}
