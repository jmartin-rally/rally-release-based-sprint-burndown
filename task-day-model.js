 function limitDecimals(initial_value) {
    return parseInt( 10*initial_value, 10 ) / 10;
 }

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
 
 function calculateDelta(initial_value, record) {
    if ( record.get('Future') ) { return null; }
    var todo = record.get('TaskRemainingTotal');
    var ideal = record.get('IdealTaskRemainingTotal');
    
    return limitDecimals(todo - ideal);
 }
 
 function checkFuture(initial_value,record) {
    if ( record.get('Future') ) { 
        return null; 
    } else { 
        return initial_value;
    }
 }
 
 Ext.define('Rally.pxs.data.TaskDay',{
    extend: 'Ext.data.Model',
    fields: [
         { name: 'IsoDate', type: 'string', convert: makeIsoDate, defaultValue: new Date() },
         { name: 'ShortIsoDate', type: 'string', convert: makeShorterIsoDate, defaultValue: null },
         { name: 'TaskRemainingTotal', type: 'float', defaultValue: 0, convert: checkFuture },
         { name: 'IdealTaskRemainingTotal', type: 'float', defaultValue: 0, convert: limitDecimals },
         { name: 'IdealTaskRemainingDelta', type: 'float', defaultValue: 0, convert: calculateDelta },
         { name: 'Future', type: 'boolean', defaultValue: false }
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
    },
    set: function(fieldName, newValue) {
        var me = this;
        var changed_fields = this.callParent([fieldName, newValue]);
        if (changed_fields !== null) {
            if ( Ext.Array.indexOf(changed_fields,"IdealTaskRemainingTotal") > -1 || Ext.Array.indexOf(changed_fields,"TaskRemainingTotal") > -1 ){
                if ( ! me.get('Future') ) {
                    var todo = me.get('TaskRemainingTotal');
                    var ideal = me.get('IdealTaskRemainingTotal');
                    
                    me.set('IdealTaskRemainingDelta',todo - ideal);
                    changed_fields.push('IdealTaskRemainingDelta');
                }
            }
            if ( Ext.Array.indexOf(changed_fields,'Future') > -1 && me.get('Future') ) {
                me.set('TaskRemainingTotal',null);
                me.set('IdealTaskRemainingDelta',null);
            }
        }
        return changed_fields;
    }
});