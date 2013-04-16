Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    version: "0.2",
    defaults: { margin: 5 },
    items: [ 
        {xtype: 'container', itemId: 'selector_box', layout: { type: 'hbox' } },
        {xtype: 'container', itemId: 'chart_box'}
    ],
    iteration_start: null,
    iteration_end: null,
    number_of_days_in_iteration: 0,
    applied_state: null,
    launch: function() {
        this._addTimeboxSelectors();
    },
    _addTimeboxSelectors: function() {
        var first_time = true;
        var me = this;
        this.down('#selector_box').add({
            xtype: 'rallyreleasecombobox',
            itemId: 'release_box',
            stateId: 'pxs.burndown.release',
            stateful: true,
            stateEvents: ['change'],
            getState: function() {
                window.console && console.log( ".......saving state", this.getRawValue() );
                return { value: this.getRawValue() };
            },
            applyState: function(state) {
                window.console && console.log(".......applying state", state);
                if ( state && state.value ) {
                    me.applied_state = state.value;
                    //this.setRawValue(state.value);
                }
            },
            listeners: {
                change: function() {
                    this._gatherData();
                },
                ready: function(cb) {
                    window.console && console.log( ".......release ready", this.applied_state );
                    // applyState (above) seems to work before the data is loaded
                    if (this.applied_state) {
                        window.console && console.log(".......re-applying state", this.applied_state);
                        var same_release = cb.findRecordByDisplay(this.applied_state);
                        if ( same_release ) {
                            cb.setValue(same_release);
                        }
                    }
                    this._gatherData();
                },
                scope: this
            },
            storeConfig: {
                listeners: {
                    load: function(store) {
                        if ( first_time ) {
                            store.loadData([{formattedName: '--ANY--',
                                            formattedStartDate: 'n/a',
                                            formattedEndDate: 'n/a',
                                            Name: '--ANY--',
                                            isSelected: false}],
                                            true);
                            store.sort('formattedStartDate', 'DESC');
                            first_time = false;
                        }
                        
                     }
                }
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
    _getDateArray: function(start_date,end_date,use_short_form) {
        window.console && console.log("_getDateArray",start_date,end_date);
        var date_array = [];
        var almost_midnight = Rally.util.DateTime.add(start_date,"minute",1435);
        while( almost_midnight < end_date ) {
            if ( use_short_form ) {
                date_array.push(Rally.util.DateTime.format(almost_midnight,'d M'));
            } else {
                date_array.push(almost_midnight);
            }
            almost_midnight = Rally.util.DateTime.add(almost_midnight,"day",1);
        }
        return date_array;
    },
    _gatherData: function() {
        window.console && console.log("_gatherData:",this.down('#release_box').getRecord());
        if(this.chart){ this.chart.destroy(); }
        if ( this.down('#release_box').getRecord() && this.down('#iteration_box').getRecord() ) {
            var selected_release = this.down('#release_box').getRecord();
            var selected_iteration = this.down('#iteration_box').getRecord();
            this.release_name = selected_release.get('Name');
            this.iteration_name = selected_iteration.get('Name');
            window.console && console.log("Release:", this.release_name, "Iteration:",this.iteration_name);
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
        this.number_of_days_in_iteration = date_array.length;
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
            {property:'Iteration',operator:'in',value:this.iteration_oids}
        ];
        if ( this.release_oids.length > 0 ) {
            query.push({property:'Release',operator:'in',value:this.release_oids});
        }
        Ext.create('Rally.data.lookback.SnapshotStore',{
            autoLoad: true,
            fetch: ['TaskRemainingTotal','Iteration','_UnformattedID'],
            filters: query,
            listeners: {
                load: function(store,data,success) {
                    window.console && console.log("load",midnight,data);
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
        this._setIdeals();
        
        var chart_store = Ext.create('Ext.data.Store',{
            autoLoad: true,
            data: {data:this._hashToArray(this.task_days)},
            model: 'Rally.pxs.data.TaskDay',
            proxy: {
                type: 'memory',
                reader: {
                    type: 'json',
                    root: 'data'
                }
            }
        });
        if(this.chart){ this.chart.destroy(); }
        this.chart = Ext.create('Rally.ui.chart.Chart',{
            height: 400,
            store: chart_store,
            series: [
                {type: 'column',dataIndex:'IdealTaskRemainingDelta',name:'Remaining to Required', visible: true, dataLabels:{
                    enabled: true
                }},
                {type: 'line', dataIndex: 'IdealTaskRemainingTotal', name: 'Work Required', visible: true},
                {type: 'line', dataIndex: 'TaskRemainingTotal', name: 'Work Remaining', visible: true}
            ],
            chartConfig: {
                chart: {},
                colors: ['#fc3','#000','#00f'],
                title: { text: 'Release Based Iteration Burn Down', align: 'center' },
                xAxis: {
                    title: { text: ""},
                    categories: this._getDateArray(this.iteration_start, this.iteration_end, true)
                },
                yAxis: [{
                    title: { text: ""},
                    plotLines: [{color:'#000',width: 2, value: 0}]
                }],
                exporting: { enabled: true }
            }
        });
        this.down('#chart_box').add(this.chart);
    },
    _setIdeals: function(){
        var start_iso = Rally.util.DateTime.toIsoString(this.iteration_start,false).replace(/T.*$/,"");
        
        var ideal_top = this.task_days[start_iso].get('TaskRemainingTotal');
        var ideal_drop = ideal_top/(this.number_of_days_in_iteration-1);
        
        // ASSUMES that the hash is in date order.  TODO: CHALLENGE this assumption
        var daily_ideal = ideal_top;
        for (var day in this.task_days ) {
            if (this.task_days.hasOwnProperty(day)){
                this.task_days[day].set('IdealTaskRemainingTotal',daily_ideal);
                daily_ideal = daily_ideal - ideal_drop;
            }
        }
    },
    _hashToArray: function(hash) {
        var the_array = [];
        var today = Rally.util.DateTime.toIsoString(new Date(),false).replace(/T.*$/,"");
        for (var key in hash ) {
            if (hash.hasOwnProperty(key)){
                var day_snap = hash[key];
                if ( key > today ) {
                    day_snap.set('Future',true);
                }
                // not sure why the model can't be pushed straight into the store
                the_array.push(hash[key].getData());
            }
        }

        return the_array;
    }
});
