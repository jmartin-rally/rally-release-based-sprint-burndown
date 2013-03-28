function makeIsoDate(initial_date,record) {
    //window.console && console.log( initial_date, typeof(initial_date));
    if ( typeof(initial_date) === "string" ) {
        return initial_date;
    }
    // assume if not a string, it's a date
    return Rally.util.DateTime.toIsoString(initial_date,false);
 }
 
 function makeShorterIsoDate(initial_date,record) {
    //window.console && console.log( initial_date, typeof(initial_date));
    if ( initial_date === null ) {
        initial_date = record.get('IsoDate');
    }
    if ( typeof(initial_date) === "string" ) {
        return initial_date.replace(/T.*$/,"");
    }
    // assume if not a string, it's a date
    return Rally.util.DateTime.toIsoString(initial_date,false).replace(/T.*$/,"");
 }
 
 Ext.define('Rally.pxs.data.TaskDay',{
    extend: 'Ext.data.Model',
    fields: [
         { name: 'IsoDate', type: 'string', convert: makeIsoDate, defaultValue: new Date() },
         { name: 'ShortIsoDate', type: 'string', convert: makeShorterIsoDate, defaultValue: null },
         { name: 'TaskRemainingTotal', type: 'float', defaultValue: 0 }
    ],
    addTo: function(field_name,additional_value) {
        var field = this._getFieldByName(field_name);
        if ( field && (field.type.type === "float" || field.type.type == "int") ) {
            var current_value = this.get(field_name) || 0;
            this.set(field_name, current_value + additional_value);
        }
    },
    _getFieldByName: function(field_name) {
        var chosen_field = null;
        Ext.Array.each( this.fields.items, function(field){
            if (field.name == field_name) {
                chosen_field = field;
            }
        });
        return chosen_field;
    }

});