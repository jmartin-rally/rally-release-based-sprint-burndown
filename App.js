Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    version: "0.1",
    defaults: { margin: 5 },
    items: [ 
        {xtype: 'container', itemId: 'selector_box', layout: { type: 'hbox' } },
        {xtype: 'container', itemId: 'grid_box'}
    ],
    iteration_start: null,
    iteration_end: null,
    launch: function() {
        this._addTimeboxSelectors();
    },
    _addTimeboxSelectors: function() {
        this.down('#selector_box').add({
            xtype: 'rallyreleasecombobox',
            itemId: 'release_box',
            listeners: {
                change: function() {
                    this._gatherData();
                },
                ready: function() {
                    this._gatherData();
                },
                scope: this
            }
        });
        this.down('#selector_box').add({
            xtype: 'rallyiterationcombobox',
            itemId: 'iteration_box',
            listeners: {
                change: function() {
                    this._gatherData();
                },
                ready: function() {
                    this._gatherData();
                },
                scope: this
            }
        });
    },
    _getDateArray: function(start_date,end_date) {
        window.console && console.log("_getDateArray",start_date,end_date);
        var date_array = [];
        var almost_midnight = Rally.util.DateTime.add(start_date,"minute",1435);
        while( almost_midnight < end_date ) {
            date_array.push(almost_midnight);
            almost_midnight = Rally.util.DateTime.add(almost_midnight,"day",1);
        }
        return date_array;
    },
    _gatherData: function() {
        if ( this.down('#release_box').getRecord() && this.down('#iteration_box').getRecord() ) {
            var selected_release = this.down('#release_box').getRecord();
            var selected_iteration = this.down('#iteration_box').getRecord();
            this.release_name = selected_release.get('Name');
            this.iteration_name = selected_iteration.get('Name');
            window.console && console.log(this.release_name);
            window.console && console.log(this.iteration_name);
            this.iteration_start = selected_iteration.get('StartDate');
            this.iteration_end = selected_iteration.get('EndDate');
            this._getIterations();
        }
    },
    _getIterations: function() {
        var me = this;
        this.iteration_oids = [];
        Ext.create('Rally.data.WsapiDataStore',{
            model: 'Iteration',
            autoLoad: true,
            filters: { property: 'Name', value: me.iteration_name },
            listeners: {
                load: function(store,data,success) {
                    Ext.Array.each(data,function(item){
                        me.iteration_oids.push(item.get('ObjectID'));
                    });
                    me._getReleases();
                }
            }
        });
    },
    _getReleases: function() {
        var me = this;
        this.release_oids = [];
        Ext.create('Rally.data.WsapiDataStore',{
            model: 'Release',
            autoLoad: true,
            filters: { property: 'Name', value: me.release_name },
            listeners: {
                load: function(store,data,success) {
                    Ext.Array.each(data,function(item){
                        me.release_oids.push(item.get('ObjectID'));
                    });
                    me._getSnapshots();
                }
            }
        });
    },
    _getSnapshots: function() {
        var date_array = this._getDateArray(this.iteration_start, this.iteration_end);
        window.console && console.log(date_array);
        
        this.task_days = {};
        this._getEndOfOneDaySnaps(date_array);
    },
    _getEndOfOneDaySnaps: function(date_array) {
        window.console && console.log( "_getEndOfOneDaySnaps", date_array);
        var midnight = date_array.shift();
        var query = [
            {property:'_TypeHierarchy',operator:'in',value:['Defect','HierarchicalRequirement','TestSet']},
            {property:'_ProjectHierarchy',operator:'=',value: this.getContext().getProject().ObjectID},
            {property:'__At',value:midnight},
            {property:'Iteration',operator:'in',value:this.iteration_oids},
            {property:'Release',operator:'in',value:this.release_oids}
        ];
        Ext.create('Rally.data.lookback.SnapshotStore',{
            autoLoad: true,
            fetch: ['TaskRemainingTotal','Iteration','_UnformattedID'],
            filters: query,
            listeners: {
                load: function(store,data,success) {
                    window.console && console.log(midnight,data);
                    var task_day = Ext.create('Rally.pxs.data.TaskDay',{IsoDate:midnight});
                    Ext.Array.each(data,function(snap) {
                        task_day.addTo("TaskRemainingTotal",snap.get('TaskRemainingTotal'));
                    });
                    this.task_days[task_day.get('ShortIsoDate')] = task_day;
                    
                    if ( date_array.length > 0 ) {
                        this._getEndOfOneDaySnaps(date_array);
                    } else {
                        this._report();
                    }
                },
                scope: this
            }
        });
    },
    _report: function() {
        window.console && console.log("_report",this.task_days);
    }
});
